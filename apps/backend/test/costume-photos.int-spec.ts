import request from 'supertest';
import { CostumePhotoDto } from '@costumes/shared';
import { TestApp, createTestApp } from './support/test-app';
import { authed, httpServer, login } from './support/http';

// Фото костюмов (T-111): загрузка через бэкенд, список, порядок, удаление, обложка в ответах.
// Реальный S3 не используется — `t.s3` хранит объекты в памяти.
describe('costume photos (integration)', () => {
  let t: TestApp;
  let api: ReturnType<typeof authed>;
  let token: string;

  beforeAll(async () => {
    t = await createTestApp();
    token = await login(t.app, t.user);
    api = authed(t.app, token);
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(() => {
    t.s3.objects.clear();
    t.s3.putObject.mockClear();
    t.s3.deleteObject.mockClear();
  });

  const jpeg = (size = 2048) =>
    Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(size)]);

  async function createCostume(name = 'Эльза'): Promise<number> {
    const res = await api.post('/costumes').send({ name }).expect(201);
    return (res.body as { costumeId: number }).costumeId;
  }

  function uploadRequest(
    costumeId: number,
    parts: { image?: Buffer; thumb?: Buffer; mime?: string } = {},
  ) {
    const req = request(httpServer(t.app))
      .post(`/costumes/${costumeId}/photos`)
      .set('Authorization', `Bearer ${token}`)
      .field('width', '1600')
      .field('height', '1200');
    const mime = parts.mime ?? 'image/jpeg';
    const image = 'image' in parts ? parts.image : jpeg();
    const thumb = 'thumb' in parts ? parts.thumb : jpeg(64);
    if (image) {
      req.attach('image', image, { filename: 'a.jpg', contentType: mime });
    }
    if (thumb) {
      req.attach('thumb', thumb, { filename: 'a_t.jpg', contentType: mime });
    }
    return req;
  }

  const upload = async (costumeId: number) =>
    (await uploadRequest(costumeId).expect(201)).body as CostumePhotoDto;

  it('requires authentication', async () => {
    await request(httpServer(t.app)).get('/costumes/1/photos').expect(401);
    await request(httpServer(t.app))
      .post('/costumes/1/photos')
      .attach('image', jpeg(), { filename: 'a.jpg', contentType: 'image/jpeg' })
      .expect(401);
  });

  it('uploads, lists, reorders and deletes photos', async () => {
    const costumeId = await createCostume();

    const first = await upload(costumeId);
    const second = await upload(costumeId);
    const third = await upload(costumeId);

    expect(first).toMatchObject({ width: 1600, height: 1200 });
    expect(first.url).toMatch(
      new RegExp(
        `^https://s3\\.test/costumes/${costumeId}/[0-9a-f-]{36}\\.jpg$`,
      ),
    );
    expect(first.thumbUrl).toMatch(/_thumb\.jpg$/);
    expect(t.s3.objects.size).toBe(6);
    const stored = t.s3.objects.get(new URL(first.url).pathname.slice(1));
    expect(stored?.contentType).toBe('image/jpeg');

    // запись в БД: ключи, размеры, автор и порядок
    const rows = await t.prisma.costumePhoto.findMany({
      where: { costumeId },
      orderBy: { sortOrder: 'asc' },
    });
    expect(rows.map((r) => r.id)).toEqual([first.id, second.id, third.id]);
    expect(rows.map((r) => r.sortOrder)).toEqual([0, 1, 2]);
    expect(rows[0].createdByUserId).not.toBeNull();
    expect(rows[0].sizeBytes).toBeGreaterThan(0);

    const list = await api.get(`/costumes/${costumeId}/photos`).expect(200);
    expect((list.body as CostumePhotoDto[]).map((p) => p.id)).toEqual([
      first.id,
      second.id,
      third.id,
    ]);

    // порядок: первое = обложка
    const reordered = await api
      .patch(`/costumes/${costumeId}/photos/order`)
      .send({ photoIds: [third.id, first.id, second.id] })
      .expect(200);
    expect((reordered.body as CostumePhotoDto[]).map((p) => p.id)).toEqual([
      third.id,
      first.id,
      second.id,
    ]);
    const search = await api
      .get('/costumes/search')
      .query({ q: 'Эльза' })
      .expect(200);
    expect(search.body).toEqual([
      expect.objectContaining({
        costumeId,
        photoCount: 3,
        coverThumbUrl: third.thumbUrl,
      }),
    ]);

    // удаление: soft delete, объекты убираются из S3 после коммита
    await api.delete(`/costumes/${costumeId}/photos/${third.id}`).expect(204);
    const deleted = await t.prisma.costumePhoto.findUniqueOrThrow({
      where: { id: third.id },
    });
    expect(deleted.deletedAt).not.toBeNull();
    expect(t.s3.deleteObject).toHaveBeenCalledTimes(2);
    expect(t.s3.objects.size).toBe(4);
    await api.delete(`/costumes/${costumeId}/photos/${third.id}`).expect(404);

    const after = await api.get(`/costumes/${costumeId}/photos`).expect(200);
    expect((after.body as CostumePhotoDto[]).map((p) => p.id)).toEqual([
      first.id,
      second.id,
    ]);
  });

  it('shows cover and photo count in costume list, availability and not written orders', async () => {
    const costumeId = await createCostume('Снеговик');
    const empty = await api
      .get(`/costumes/${costumeId}/availability`)
      .expect(200);
    expect(empty.body).toMatchObject({ photoCount: 0 });
    expect(empty.body).not.toHaveProperty('coverThumbUrl');

    const photo = await upload(costumeId);
    await upload(costumeId);

    const availability = await api
      .get(`/costumes/${costumeId}/availability`)
      .expect(200);
    expect(availability.body).toMatchObject({
      photoCount: 2,
      coverThumbUrl: photo.thumbUrl,
    });
    const list = await api.get('/costumes/list').expect(200);
    expect(
      (
        list.body as {
          items: { costumeId: number; photoCount: number }[];
        }
      ).items.find((i) => i.costumeId === costumeId),
    ).toMatchObject({ photoCount: 2, coverThumbUrl: photo.thumbUrl });

    // бронь с этим костюмом → бирки, выдача, возврат несут обложку и число фото
    const client = await api
      .post('/clients')
      .send({ name: 'Алия', phone: '+77071110077' })
      .expect(201);
    const clientId = (client.body as { clientId: number }).clientId;
    const child = await api
      .post('/children')
      .send({ clientId, name: 'Маша' })
      .expect(201);
    const childId = (child.body as { childId: number }).childId;
    const code = (await api.post('/visits/preview-code').expect(201))
      .body as string;
    await api
      .post('/visits?sendNotification=false')
      .send({
        clientId,
        visitCode: code,
        startDateTime: '2026-12-20',
        endDateTime: '2026-12-21',
        issueTimeFrom: '10:00',
        issueTimeTo: '19:00',
        returnTimeUntil: '19:00',
        orders: [
          { childId, costumeId, rentPrice: 5000, prepaymentAmount: 1000 },
        ],
      })
      .expect(201);
    const visit = await t.prisma.visit.findUniqueOrThrow({
      where: { visitCode: code },
    });

    const tags = await api.get('/visits/not_written').expect(200);
    expect(
      (tags.body as { items: Record<string, unknown>[] }).items[0],
    ).toMatchObject({ photoCount: 2, coverThumbUrl: photo.thumbUrl });

    const forIssue = await api.get(`/visits/${visit.id}/for-issue`).expect(200);
    expect(
      (forIssue.body as { orders: Record<string, unknown>[] }).orders[0],
    ).toMatchObject({ photoCount: 2, coverThumbUrl: photo.thumbUrl });

    const detail = await api.get(`/visits/${visit.id}`).expect(200);
    expect(
      (detail.body as { orders: Record<string, unknown>[] }).orders[0],
    ).toMatchObject({ photoCount: 2, coverThumbUrl: photo.thumbUrl });

    await api
      .post(`/visits/${visit.id}/issue`)
      .send({ additionalPayment: 4000, deposit: { type: 'none' } })
      .expect(204);
    const forReturn = await api
      .get(`/visits/${visit.id}/for-return`)
      .expect(200);
    expect(
      (forReturn.body as { orders: Record<string, unknown>[] }).orders[0],
    ).toMatchObject({ photoCount: 2, coverThumbUrl: photo.thumbUrl });
  });

  it('rejects files that are not jpeg or webp by signature', async () => {
    const costumeId = await createCostume();
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
    ]);

    const fake = await uploadRequest(costumeId, { image: png }).expect(400);
    expect((fake.body as { message: string }).message).toMatch(/JPEG и WebP/);
    await uploadRequest(costumeId, { mime: 'image/png' }).expect(400);
    await uploadRequest(costumeId, { thumb: undefined }).expect(400);
    expect(t.s3.putObject).not.toHaveBeenCalled();
    expect(await t.prisma.costumePhoto.count({ where: { costumeId } })).toBe(0);
  });

  it('rejects oversized files and invalid dimensions', async () => {
    const costumeId = await createCostume();
    const big = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff]),
      Buffer.alloc(2 * 1024 * 1024),
    ]);
    await uploadRequest(costumeId, { image: big }).expect(413);
    await uploadRequest(costumeId, { thumb: jpeg(210 * 1024) }).expect(400);
    await request(httpServer(t.app))
      .post(`/costumes/${costumeId}/photos`)
      .set('Authorization', `Bearer ${token}`)
      .field('width', '0')
      .field('height', '1200')
      .attach('image', jpeg(), { filename: 'a.jpg', contentType: 'image/jpeg' })
      .attach('thumb', jpeg(8), {
        filename: 't.jpg',
        contentType: 'image/jpeg',
      })
      .expect(400);
    expect(t.s3.putObject).not.toHaveBeenCalled();
  });

  it('limits a costume to 15 photos and counts only active ones', async () => {
    const costumeId = await createCostume();
    const ids: number[] = [];
    for (let i = 0; i < 15; i += 1) ids.push((await upload(costumeId)).id);

    const rejected = await uploadRequest(costumeId).expect(409);
    expect((rejected.body as { message: string }).message).toMatch(/15 фото/);
    expect(t.s3.objects.size).toBe(30);

    // удалённое фото освобождает место
    await api.delete(`/costumes/${costumeId}/photos/${ids[0]}`).expect(204);
    await uploadRequest(costumeId).expect(201);
  });

  it('keeps the limit under parallel uploads', async () => {
    const costumeId = await createCostume();
    for (let i = 0; i < 13; i += 1) await upload(costumeId);

    const results = await Promise.all(
      Array.from({ length: 5 }, () => uploadRequest(costumeId)),
    );
    const statuses = results.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 201)).toHaveLength(2);
    expect(statuses.filter((s) => s === 409)).toHaveLength(3);
    expect(
      await t.prisma.costumePhoto.count({
        where: { costumeId, deletedAt: null },
      }),
    ).toBe(15);
    // отклонённые загрузки не оставляют файлов в бакете
    expect(t.s3.objects.size).toBe(30);
  });

  it('does not accept photos of a deleted costume and ignores foreign photos', async () => {
    const costumeId = await createCostume();
    const other = await createCostume('Принцесса');
    const photo = await upload(other);

    // чужое фото через другой костюм не удаляется
    await api.delete(`/costumes/${costumeId}/photos/${photo.id}`).expect(404);
    await api
      .patch(`/costumes/${costumeId}/photos/order`)
      .send({ photoIds: [photo.id] })
      .expect(400);

    await api.delete(`/costumes/${costumeId}`).expect(204);
    await uploadRequest(costumeId).expect(404);
    await api.get(`/costumes/${costumeId}/photos`).expect(404);
    await api.get('/costumes/999999/photos').expect(404);
  });

  it('answers a clear error when S3 is not configured', async () => {
    const costumeId = await createCostume();
    t.s3.assertConfigured.mockImplementationOnce(() => {
      throw new (jest.requireActual<typeof import('@nestjs/common')>(
        '@nestjs/common',
      ).ServiceUnavailableException)('Хранилище фото не настроено');
    });
    const res = await uploadRequest(costumeId).expect(503);
    expect((res.body as { message: string }).message).toMatch(/не настроено/);
  });
});

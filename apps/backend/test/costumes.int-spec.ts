import { TestApp, createTestApp } from './support/test-app';
import { authed, login } from './support/http';

describe('costumes (integration)', () => {
  let t: TestApp;
  let api: ReturnType<typeof authed>;

  beforeAll(async () => {
    t = await createTestApp();
    api = authed(t.app, await login(t.app, t.user));
  });

  afterAll(async () => {
    await t.close();
  });

  it('generates an inventory code and keeps a deleted costume out of search and list', async () => {
    const created = await api
      .post('/costumes')
      .send({ name: 'Эльза' })
      .expect(201);
    const body = created.body as { costumeId: number; inventoryCode: string };
    expect(body.inventoryCode).toMatch(/^C-\d{4}$/);
    expect(
      await t.prisma.costume.findUnique({ where: { id: body.costumeId } }),
    ).toMatchObject({
      inventoryCode: body.inventoryCode,
      deletedAt: null,
    });

    await api.delete(`/costumes/${body.costumeId}`).expect(204);
    expect(
      await t.prisma.costume.findUnique({ where: { id: body.costumeId } }),
    ).toMatchObject({
      deletedAt: expect.any(Date) as never,
    });
    await api
      .patch(`/costumes/${body.costumeId}`)
      .send({ name: 'Изменённый костюм' })
      .expect(404);
    await api.delete(`/costumes/${body.costumeId}`).expect(404);

    const search = await api
      .get('/costumes/search')
      .query({ q: 'Эльза' })
      .expect(200);
    expect(search.body).toEqual([]);
    const list = await api.get('/costumes/list').expect(200);
    expect(list.body).toMatchObject({ items: [], total: 0 });
  });

  let fixtureCode = 7000;

  async function seedReservation(costumeName: string, phone: string) {
    const clientRes = await api
      .post('/clients')
      .send({ name: 'Тестовый клиент', phone })
      .expect(201);
    const clientId = (clientRes.body as { clientId: number }).clientId;

    const childRes = await api
      .post('/children')
      .send({ clientId, name: 'Тестовый ребёнок' })
      .expect(201);
    const childId = (childRes.body as { childId: number }).childId;

    const costumeRes = await api
      .post('/costumes')
      .send({ name: costumeName })
      .expect(201);
    const costumeId = (costumeRes.body as { costumeId: number }).costumeId;
    const startDateTime = new Date('2026-12-20T10:00:00.000Z');
    const endDateTime = new Date('2026-12-21T10:00:00.000Z');

    const visit = await t.prisma.visit.create({
      data: {
        visitCode: String(fixtureCode++),
        clientId,
        startDateTime,
        endDateTime,
        issueTimeFrom: '10:00',
        issueTimeTo: '19:00',
        returnTimeUntil: '19:00',
      },
    });
    const order = await t.prisma.order.create({
      data: {
        visitId: visit.id,
        clientId,
        childId,
        costumeId,
        startDateTime,
        endDateTime,
        rentPrice: 5000,
      },
    });

    return { costumeId, visitId: visit.id, orderId: order.id };
  }

  async function expectCostumeAvailable(
    costumeName: string,
    costumeId: number,
  ) {
    const search = await api
      .get('/costumes/search-available')
      .query({
        q: costumeName,
        startDate: '2026-12-20',
        endDate: '2026-12-21',
      })
      .expect(200);
    expect(search.body).toMatchObject([{ costumeId, status: 'available' }]);

    const availability = await api
      .get(`/costumes/${costumeId}/availability`)
      .expect(200);
    expect(availability.body).toMatchObject({
      costumeId,
      periods: [],
      noPeriodsMessage: 'На выбранный костюм активных броней не найдено',
    });
  }

  it('ignores a soft-deleted order in available search and availability', async () => {
    const fixture = await seedReservation(
      'Удалённый заказ T078',
      '+77071117801',
    );
    await t.prisma.order.update({
      where: { id: fixture.orderId },
      data: { deletedAt: new Date() },
    });

    await expectCostumeAvailable('Удалённый заказ T078', fixture.costumeId);
  });

  it('ignores a soft-deleted visit in available search and availability', async () => {
    const fixture = await seedReservation(
      'Удалённый визит T078',
      '+77071117802',
    );
    await t.prisma.visit.update({
      where: { id: fixture.visitId },
      data: { deletedAt: new Date() },
    });

    await expectCostumeAvailable('Удалённый визит T078', fixture.costumeId);
  });
});

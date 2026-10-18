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

    const search = await api
      .get('/costumes/search')
      .query({ q: 'Эльза' })
      .expect(200);
    expect(search.body).toEqual([]);
    const list = await api.get('/costumes/list').expect(200);
    expect(list.body).toMatchObject({ items: [], total: 0 });
  });
});

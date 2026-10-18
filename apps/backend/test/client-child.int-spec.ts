import { TestApp, createTestApp } from './support/test-app';
import { authed, login } from './support/http';

describe('clients and children (integration)', () => {
  let t: TestApp;
  let api: ReturnType<typeof authed>;

  beforeAll(async () => {
    t = await createTestApp();
    api = authed(t.app, await login(t.app, t.user));
  });

  afterAll(async () => {
    await t.close();
  });

  it.each([
    [{ name: 'А', phone: '+77071234567' }],
    [{ name: 'A!', phone: '+77071234567' }],
    [{ name: 'Алия', phone: '87071234567' }],
    [{ name: 'Алия', phone: '+7707123456' }],
  ])('rejects invalid client input %#', async (body) => {
    await api.post('/clients').send(body).expect(400);
  });

  it('creates a client and child, then soft-deletes both', async () => {
    const clientResponse = await api
      .post('/clients')
      .send({ name: 'Тестовый клиент', phone: '+77079990001' })
      .expect(201);
    const clientId = (clientResponse.body as { clientId: number }).clientId;
    const childResponse = await api
      .post('/children')
      .send({ clientId, name: 'Тестовый ребёнок' })
      .expect(201);
    const childId = (childResponse.body as { childId: number }).childId;

    await api.delete(`/children/${childId}`).expect(204);
    await api.delete(`/clients/${clientId}`).expect(204);

    const deletedChild = await t.prisma.child.findUniqueOrThrow({
      where: { id: childId },
    });
    const deletedClient = await t.prisma.client.findUniqueOrThrow({
      where: { id: clientId },
    });
    expect(deletedChild.clientId).toBe(clientId);
    expect(deletedChild.deletedAt).toBeInstanceOf(Date);
    expect(deletedClient.deletedAt).toBeInstanceOf(Date);
    await api.get('/clients/search?q=Тестовый').expect(200).expect([]);
    const list = await api.get('/clients/list').expect(200);
    expect(
      (list.body as { items: { clientId: number }[] }).items.some(
        (item) => item.clientId === clientId,
      ),
    ).toBe(false);
    await api.get(`/clients/detail/${clientId}`).expect(404);
  });

  it('rejects a child for a missing client', async () => {
    await api
      .post('/children')
      .send({ clientId: 999999, name: 'Маша' })
      .expect(404);
  });

  it('rejects child and client mutations after soft deletion', async () => {
    const clientResponse = await api
      .post('/clients')
      .send({ name: 'Удалённый клиент', phone: '+77079990004' })
      .expect(201);
    const clientId = (clientResponse.body as { clientId: number }).clientId;
    const childResponse = await api
      .post('/children')
      .send({ clientId, name: 'Удалённый ребёнок' })
      .expect(201);
    const childId = (childResponse.body as { childId: number }).childId;

    await api.delete(`/children/${childId}`).expect(204);
    await api.delete(`/clients/${clientId}`).expect(204);
    const deletedClientBefore = await t.prisma.client.findUniqueOrThrow({
      where: { id: clientId },
    });
    const deletedChildBefore = await t.prisma.child.findUniqueOrThrow({
      where: { id: childId },
    });

    await api
      .post('/children')
      .send({ clientId, name: 'Новый ребёнок' })
      .expect(404);
    expect(
      await t.prisma.child.count({
        where: { clientId, name: 'Новый ребёнок', deletedAt: null },
      }),
    ).toBe(0);
    await api
      .patch(`/children/${childId}`)
      .send({ name: 'Изменение' })
      .expect(404);
    await api.delete(`/children/${childId}`).expect(404);
    await api
      .patch(`/clients/${clientId}`)
      .send({ name: 'Изменение', phone: '+77079990004' })
      .expect(404);
    await api.delete(`/clients/${clientId}`).expect(404);
    await api
      .post(`/clients/${clientId}/blacklist`)
      .send({ blacklistReason: 'причина' })
      .expect(404);
    await api.delete(`/clients/${clientId}/blacklist`).expect(404);

    expect(
      await t.prisma.client.findUniqueOrThrow({ where: { id: clientId } }),
    ).toEqual(deletedClientBefore);
    expect(
      await t.prisma.child.findUniqueOrThrow({ where: { id: childId } }),
    ).toEqual(deletedChildBefore);
  });

  it('finds a stored +7 phone by its equivalent 8 prefix', async () => {
    const clientResponse = await api
      .post('/clients')
      .send({ name: 'Телефонный поиск', phone: '+77079990005' })
      .expect(201);
    const clientId = (clientResponse.body as { clientId: number }).clientId;

    const localFormatSearch = await api
      .get('/clients/search?q=87079990005')
      .expect(200);
    const countryCodeSearch = await api
      .get('/clients/search?q=%2B77079990005')
      .expect(200);
    const fragmentSearch = await api.get('/clients/search?q=99000').expect(200);

    for (const response of [
      localFormatSearch,
      countryCodeSearch,
      fragmentSearch,
    ]) {
      expect(response.body).toContainEqual(
        expect.objectContaining({ clientId, phone: '+77079990005' }),
      );
    }
  });

  it('blacklists a client, rejects booking with the reason, then allows booking after removal', async () => {
    const clientResponse = await api
      .post('/clients')
      .send({ name: 'Клиент ЧС', phone: '+77079990002' })
      .expect(201);
    const clientId = (clientResponse.body as { clientId: number }).clientId;
    const childResponse = await api
      .post('/children')
      .send({ clientId, name: 'Маша' })
      .expect(201);
    const childId = (childResponse.body as { childId: number }).childId;
    const costumeResponse = await api
      .post('/costumes')
      .send({ name: 'Костюм для теста ЧС' })
      .expect(201);
    const costumeId = (costumeResponse.body as { costumeId: number }).costumeId;

    await api
      .post(`/clients/${clientId}/blacklist`)
      .send({ blacklistReason: 'не вернула костюм' })
      .expect(201);
    await api
      .post(`/clients/${clientId}/blacklist`)
      .send({ blacklistReason: 'повторное нарушение' })
      .expect(201);
    expect(
      await t.prisma.client.findUniqueOrThrow({ where: { id: clientId } }),
    ).toMatchObject({
      isBlacklisted: true,
      blacklistReason: 'повторное нарушение',
    });

    const codeResponse = await api.post('/visits/preview-code').expect(201);
    const visitCode = codeResponse.body as string;
    const visitBody = {
      clientId,
      visitCode,
      startDateTime: '2026-12-20',
      endDateTime: '2026-12-21',
      issueTimeFrom: '10:00',
      issueTimeTo: '19:00',
      returnTimeUntil: '19:00',
      orders: [{ childId, costumeId, rentPrice: 5000, prepaymentAmount: 1000 }],
    };
    const rejected = await api
      .post('/visits?sendNotification=false')
      .send(visitBody)
      .expect(400);
    expect((rejected.body as { message: string }).message).toContain(
      'повторное нарушение',
    );
    expect(await t.prisma.visit.count({ where: { visitCode } })).toBe(0);

    await api.delete(`/clients/${clientId}/blacklist`).expect(204);
    expect(
      await t.prisma.client.findUniqueOrThrow({ where: { id: clientId } }),
    ).toMatchObject({ isBlacklisted: false, blacklistReason: null });
    const nextCodeResponse = await api.post('/visits/preview-code').expect(201);
    await api
      .post('/visits?sendNotification=false')
      .send({ ...visitBody, visitCode: nextCodeResponse.body as string })
      .expect(201);
    expect(
      await t.prisma.visit.count({
        where: { visitCode: nextCodeResponse.body as string, clientId },
      }),
    ).toBe(1);
  });

  it('soft-deletes a client with an active visit and keeps the visit record', async () => {
    const clientResponse = await api
      .post('/clients')
      .send({ name: 'Клиент с активным визитом', phone: '+77079990003' })
      .expect(201);
    const clientId = (clientResponse.body as { clientId: number }).clientId;
    const childResponse = await api
      .post('/children')
      .send({ clientId, name: 'Маша' })
      .expect(201);
    const costumeResponse = await api
      .post('/costumes')
      .send({ name: 'Костюм активного визита' })
      .expect(201);
    const codeResponse = await api.post('/visits/preview-code').expect(201);
    await api
      .post('/visits?sendNotification=false')
      .send({
        clientId,
        visitCode: codeResponse.body as string,
        startDateTime: '2026-12-20',
        endDateTime: '2026-12-21',
        issueTimeFrom: '10:00',
        issueTimeTo: '19:00',
        returnTimeUntil: '19:00',
        orders: [
          {
            childId: (childResponse.body as { childId: number }).childId,
            costumeId: (costumeResponse.body as { costumeId: number })
              .costumeId,
            rentPrice: 5000,
            prepaymentAmount: 1000,
          },
        ],
      })
      .expect(201);

    await api.delete(`/clients/${clientId}`).expect(204);

    const deletedClient = await t.prisma.client.findUniqueOrThrow({
      where: { id: clientId },
    });
    expect(deletedClient.deletedAt).toBeInstanceOf(Date);
    expect(
      await t.prisma.visit.findUniqueOrThrow({
        where: { visitCode: codeResponse.body as string },
      }),
    ).toMatchObject({ clientId, status: 'reserved' });
  });
});

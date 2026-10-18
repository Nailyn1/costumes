import { TestApp, createTestApp } from './support/test-app';
import { authed, login } from './support/http';

describe('visit booking and deposit guards (integration)', () => {
  let t: TestApp;
  let api: ReturnType<typeof authed>;

  beforeAll(async () => {
    t = await createTestApp();
    api = authed(t.app, await login(t.app, t.user));
  });

  afterAll(async () => {
    await t.close();
  });

  async function fixture(phone: string) {
    const clientId = (
      (await api.post('/clients').send({ name: 'Алия', phone }).expect(201))
        .body as { clientId: number }
    ).clientId;
    const childId = (
      (await api.post('/children').send({ clientId, name: 'Маша' }).expect(201))
        .body as { childId: number }
    ).childId;
    const costumeId = (
      (await api.post('/costumes').send({ name: 'Эльза' }).expect(201))
        .body as {
        costumeId: number;
      }
    ).costumeId;
    const visitCode = (await api.post('/visits/preview-code').expect(201))
      .body as string;
    const order = {
      childId,
      costumeId,
      rentPrice: 5000,
      prepaymentAmount: 5000,
    };
    const body = {
      clientId,
      visitCode,
      startDateTime: '2026-12-20',
      endDateTime: '2026-12-21',
      issueTimeFrom: '18:30',
      issueTimeTo: '19:30',
      returnTimeUntil: '18:00',
      orders: [order],
    };
    return { visitCode, costumeId, body, order };
  }

  it('rejects duplicate costumes without creating a visit or order', async () => {
    const f = await fixture('+77071110184');
    const response = await api
      .post('/visits?sendNotification=false')
      .send({ ...f.body, orders: [f.order, f.order] })
      .expect(400);
    expect(JSON.stringify(response.body)).toContain('один костюм');
    expect(
      await t.prisma.visit.count({ where: { visitCode: f.visitCode } }),
    ).toBe(0);
    expect(
      await t.prisma.order.count({ where: { costumeId: f.costumeId } }),
    ).toBe(0);

    const secondCostumeId = (
      (await api.post('/costumes').send({ name: 'Снежинка' }).expect(201))
        .body as { costumeId: number }
    ).costumeId;
    await api
      .post('/visits?sendNotification=false')
      .send({
        ...f.body,
        orders: [f.order, { ...f.order, costumeId: secondCostumeId }],
      })
      .expect(201);
    expect(
      (
        await t.prisma.visit.findUniqueOrThrow({
          where: { visitCode: f.visitCode },
          include: { orders: true },
        })
      ).orders,
    ).toHaveLength(2);
  });

  it('returns deposit only for a completed visit with cash and stays idempotent', async () => {
    const f = await fixture('+77071110183');
    await api.post('/visits?sendNotification=false').send(f.body).expect(201);
    const visit = await t.prisma.visit.findUniqueOrThrow({
      where: { visitCode: f.visitCode },
    });
    const endpoint = `/visits/${visit.id}/mark-deposit-returned`;
    await api.post(endpoint).send({}).expect(400);
    await api
      .post(`/visits/${visit.id}/issue`)
      .send({ additionalPayment: 0, deposit: { type: 'cash', amount: 5000 } })
      .expect(204);
    await api.post(endpoint).send({}).expect(400);
    expect(
      (
        await t.prisma.deposit.findUniqueOrThrow({
          where: { visitId: visit.id },
        })
      ).returned,
    ).toBe(false);
    await api
      .post(`/visits/${visit.id}/complete-return`)
      .send({ depositReturned: false })
      .expect(201);
    await api.post(endpoint).send({}).expect(201);
    await api.post(endpoint).send({}).expect(201);
    expect(
      (
        await t.prisma.deposit.findUniqueOrThrow({
          where: { visitId: visit.id },
        })
      ).returned,
    ).toBe(true);
    await api.post('/visits/999999/mark-deposit-returned').send({}).expect(404);
  });

  it('rejects a completed visit with deposit type none', async () => {
    const f = await fixture('+77071110185');
    await api.post('/visits?sendNotification=false').send(f.body).expect(201);
    const visit = await t.prisma.visit.findUniqueOrThrow({
      where: { visitCode: f.visitCode },
    });
    await api
      .post(`/visits/${visit.id}/issue`)
      .send({ additionalPayment: 0, deposit: { type: 'none' } })
      .expect(204);
    await api
      .post(`/visits/${visit.id}/complete-return`)
      .send({ depositReturned: false })
      .expect(201);
    await api
      .post(`/visits/${visit.id}/mark-deposit-returned`)
      .send({})
      .expect(400);
    expect(
      (
        await t.prisma.deposit.findUniqueOrThrow({
          where: { visitId: visit.id },
        })
      ).returned,
    ).toBe(false);
  });
});

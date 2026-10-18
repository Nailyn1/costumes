import { TestApp, createTestApp } from './support/test-app';
import { authed, login } from './support/http';

describe('early costume return (integration)', () => {
  let t: TestApp;
  let api: ReturnType<typeof authed>;

  beforeAll(async () => {
    t = await createTestApp();
    api = authed(t.app, await login(t.app, t.user));
  });

  afterAll(async () => {
    await t.close();
  });

  it('allows a new overlapping booking after the previous order is returned', async () => {
    const clientResponse = await api
      .post('/clients')
      .send({ name: 'Алия', phone: '+77071110025' })
      .expect(201);
    const clientId = (clientResponse.body as { clientId: number }).clientId;

    const childResponse = await api
      .post('/children')
      .send({ clientId, name: 'Маша' })
      .expect(201);
    const childId = (childResponse.body as { childId: number }).childId;

    const costumeResponse = await api
      .post('/costumes')
      .send({ name: 'Эльза' })
      .expect(201);
    const costumeId = (costumeResponse.body as { costumeId: number }).costumeId;

    const reserveVisitCode = async (): Promise<string> => {
      const response = await api.post('/visits/preview-code').expect(201);
      return response.body as string;
    };

    const visitBody = (visitCode: string, endDateTime: string) => ({
      clientId,
      visitCode,
      startDateTime: '2026-12-20',
      endDateTime,
      issueTimeFrom: '10:00',
      issueTimeTo: '19:00',
      returnTimeUntil: '19:00',
      orders: [{ childId, costumeId, rentPrice: 5000, prepaymentAmount: 1000 }],
    });

    await api
      .post('/visits?sendNotification=false')
      .send(visitBody(await reserveVisitCode(), '2026-12-25'))
      .expect(201);

    const original = await t.prisma.visit.findFirstOrThrow({
      where: { clientId },
      include: { orders: true },
    });
    await api
      .post(`/visits/${original.id}/issue`)
      .send({ additionalPayment: 4000, deposit: { type: 'none' } })
      .expect(204);
    await api
      .post(`/visits/${original.id}/complete-return`)
      .send({ depositReturned: false, notes: 'вернули раньше срока' })
      .expect(201);

    const returnedOrder = await t.prisma.order.findFirstOrThrow({
      where: { visitId: original.id },
    });
    expect(returnedOrder.status).toBe('returned');
    expect(original.endDateTime.toISOString()).toBe('2026-12-25T19:00:00.000Z');

    const nextBooking = await api
      .post('/visits?sendNotification=false')
      .send(visitBody(await reserveVisitCode(), '2026-12-23'))
      .expect(201);

    expect(nextBooking.status).toBe(201);
    expect(
      await t.prisma.order.count({
        where: { costumeId, status: 'reserved', deletedAt: null },
      }),
    ).toBe(1);
  });
});

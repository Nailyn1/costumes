import { TestApp, createTestApp } from './support/test-app';
import { authed, login } from './support/http';

interface BalanceBody {
  totalRent: number;
  totalPrepayment: number;
  totalReceived: number;
  totalRefunded: number;
  signedBalance: number;
  debt: number;
  refundDue: number;
}

describe('visit money balance (integration)', () => {
  let t: TestApp;
  let api: ReturnType<typeof authed>;
  let nextCode = 8000;
  let nextPhone = 77078880000;

  beforeAll(async () => {
    t = await createTestApp();
    api = authed(t.app, await login(t.app, t.user));
  });

  afterAll(async () => {
    await t.close();
  });

  async function createReservedVisit() {
    const client = await t.prisma.client.create({
      data: { name: 'Клиент расчёта', phone: `+${nextPhone++}` },
    });
    const child = await t.prisma.child.create({
      data: { clientId: client.id, name: 'Ребёнок расчёта' },
    });
    const costume = await t.prisma.costume.create({
      data: { name: 'Костюм расчёта' },
    });
    const visit = await t.prisma.visit.create({
      data: {
        visitCode: String(nextCode++),
        clientId: client.id,
        startDateTime: new Date('2026-12-20T10:00:00Z'),
        endDateTime: new Date('2026-12-21T10:00:00Z'),
        issueTimeFrom: '10:00',
        issueTimeTo: '19:00',
        returnTimeUntil: '19:00',
      },
    });
    await t.prisma.order.create({
      data: {
        visitId: visit.id,
        clientId: client.id,
        childId: child.id,
        costumeId: costume.id,
        startDateTime: visit.startDateTime,
        endDateTime: visit.endDateTime,
        rentPrice: 5000,
        prepaymentAmount: 1000,
      },
    });
    return visit;
  }

  it('preserves overpayment, records a partial refund on return, then settles the remainder', async () => {
    const visit = await createReservedVisit();
    await api
      .post(`/visits/${visit.id}/issue`)
      .send({ additionalPayment: 5000, deposit: { type: 'none' } })
      .expect(204);
    const beforeReturn = await api
      .get(`/visits/${visit.id}/for-return`)
      .expect(200);
    expect(beforeReturn.body).toMatchObject({
      startDateTime: '2026-12-20',
      endDateTime: '2026-12-21',
    });
    expect(
      (beforeReturn.body as { balance: BalanceBody }).balance,
    ).toMatchObject({
      totalRent: 5000,
      totalPrepayment: 1000,
      totalReceived: 5000,
      signedBalance: -1000,
      refundDue: 1000,
    });

    const completed = await api
      .post(`/visits/${visit.id}/complete-return`)
      .send({
        depositReturned: false,
        settlement: { kind: 'customer_refund', amount: 600 },
      })
      .expect(201);
    expect((completed.body as { balance: BalanceBody }).balance.refundDue).toBe(
      400,
    );
    expect(
      await t.prisma.visit.findUniqueOrThrow({ where: { id: visit.id } }),
    ).toMatchObject({
      status: 'completed',
    });
    await api
      .post(`/visits/${visit.id}/complete-return`)
      .send({
        depositReturned: false,
        settlement: { kind: 'customer_refund', amount: 600 },
      })
      .expect(400);
    expect(
      await t.prisma.visitMoneyOperation.count({
        where: { visitId: visit.id, kind: 'customer_refund' },
      }),
    ).toBe(1);

    await api
      .post(`/visits/${visit.id}/settlement`)
      .send({ kind: 'customer_refund', amount: 401 })
      .expect(400);
    const final = await api
      .post(`/visits/${visit.id}/settlement`)
      .send({ kind: 'customer_refund', amount: 400 })
      .expect(200);
    expect(final.body as BalanceBody).toMatchObject({
      totalRefunded: 1000,
      signedBalance: 0,
      refundDue: 0,
    });
    const list = await api.get('/visits/unsettled-balances').expect(200);
    expect(
      (list.body as { items: { visitId: number }[] }).items,
    ).not.toContainEqual(expect.objectContaining({ visitId: visit.id }));
  });

  it('allows completion with debt and later records a partial debt payment', async () => {
    const visit = await createReservedVisit();
    await api
      .post(`/visits/${visit.id}/issue`)
      .send({ additionalPayment: 1000, deposit: { type: 'none' } })
      .expect(204);
    const completed = await api
      .post(`/visits/${visit.id}/complete-return`)
      .send({ depositReturned: false })
      .expect(201);
    expect((completed.body as { balance: BalanceBody }).balance.debt).toBe(
      3000,
    );
    const list = await api.get('/visits/unsettled-balances').expect(200);
    expect(
      (list.body as { items: { visitId: number }[] }).items,
    ).toContainEqual(expect.objectContaining({ visitId: visit.id }));
    const partial = await api
      .post(`/visits/${visit.id}/settlement`)
      .send({ kind: 'debt_payment', amount: 1500 })
      .expect(200);
    expect(partial.body as BalanceBody).toMatchObject({
      totalReceived: 2500,
      debt: 1500,
    });
  });

  it('voids issue payment on unissue and does not count it after reissue', async () => {
    const visit = await createReservedVisit();
    await api
      .post(`/visits/${visit.id}/issue`)
      .send({ additionalPayment: 5000, deposit: { type: 'none' } })
      .expect(204);
    await api.post(`/visits/${visit.id}/unissue`).expect(204);
    expect(
      await t.prisma.visitMoneyOperation.findMany({
        where: { visitId: visit.id },
      }),
    ).toEqual([
      expect.objectContaining({
        kind: 'issue_payment',
        amount: 5000,
        voidedAt: expect.any(Date) as Date,
      }),
    ]);
    await api
      .post(`/visits/${visit.id}/issue`)
      .send({ additionalPayment: 0, deposit: { type: 'none' } })
      .expect(204);
    const balance = await api.get(`/visits/${visit.id}/balance`).expect(200);
    expect(balance.body as BalanceBody).toMatchObject({
      totalReceived: 0,
      debt: 4000,
    });
  });
});

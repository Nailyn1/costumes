import { randomUUID } from 'node:crypto';
import { TestApp, createTestApp } from './support/test-app';
import { authed, login } from './support/http';
import { VisitOrderService } from '../src/visit-order/visit-order.service';

describe('quick issue (integration)', () => {
  let t: TestApp;
  let api: ReturnType<typeof authed>;
  let nextPhone = 77079980000;

  beforeAll(async () => {
    t = await createTestApp();
    api = authed(t.app, await login(t.app, t.user));
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(() => {
    t.notificationQueue.add.mockClear();
    t.whatsapp.sendMessage.mockClear();
  });

  interface BookingIds {
    clientId: number;
    childId: number;
    costumeId: number;
  }

  async function seedBooking(): Promise<BookingIds> {
    const client = await api
      .post('/clients')
      .send({ name: 'Клиент быстрой выдачи', phone: `+${nextPhone++}` })
      .expect(201);
    const clientId = (client.body as { clientId: number }).clientId;
    const child = await api
      .post('/children')
      .send({ clientId, name: 'Ребёнок быстрой выдачи' })
      .expect(201);
    const childId = (child.body as { childId: number }).childId;
    const costume = await api
      .post('/costumes')
      .send({ name: 'Костюм быстрой выдачи' })
      .expect(201);
    return {
      clientId,
      childId,
      costumeId: (costume.body as { costumeId: number }).costumeId,
    };
  }

  async function reservedCode(): Promise<string> {
    const response = await api.post('/visits/preview-code').expect(201);
    return response.body as string;
  }

  function quickIssueBody(
    ids: BookingIds,
    visitCode: string,
    overrides: {
      date?: string;
      additionalPayment?: number;
      depositType?: 'cash' | 'document' | 'none';
      depositAmount?: number;
    } = {},
  ) {
    const date = overrides.date ?? '2026-12-20';
    const endDateTime = `2026-12-${String(Number(date.slice(-2)) + 1).padStart(2, '0')}`;
    return {
      commandId: randomUUID(),
      clientId: ids.clientId,
      visitCode,
      startDateTime: date,
      issueTimeFrom: '10:07',
      issueTimeTo: '10:07',
      endDateTime,
      returnTimeUntil: '19:00',
      orders: [
        {
          childId: ids.childId,
          costumeId: ids.costumeId,
          rentPrice: 5000,
          notes: 'Срочная выдача',
        },
      ],
      additionalPayment: overrides.additionalPayment ?? 1500,
      deposit: {
        type: overrides.depositType ?? 'cash',
        amount: overrides.depositAmount ?? 3000,
      },
    };
  }

  it('atomically creates and issues with server audit, no notification, and exact replay', async () => {
    const ids = await seedBooking();
    const baseBody = quickIssueBody(ids, await reservedCode());
    const body = {
      ...baseBody,
      status: 'cancelled',
      deletedAt: '2020-01-01T00:00:00.000Z',
      actorUserId: 999999,
      actorNameSnapshot: 'Поддельный автор',
      orders: baseBody.orders.map((order) => ({
        ...order,
        id: 999999,
        status: 'cancelled',
        tagStatus: 'written',
        prepaymentAmount: 4900,
        finalPayment: 4900,
        deletedAt: '2020-01-01T00:00:00.000Z',
      })),
    };
    const response = await api
      .post('/visits/quick-issue')
      .send(body)
      .expect(201);
    expect(response.body).toMatchObject({
      visitCode: body.visitCode,
      status: 'issued',
      version: 1,
      balance: {
        totalRent: 5000,
        totalPrepayment: 0,
        totalReceived: 1500,
        signedBalance: 3500,
        debt: 3500,
      },
    });
    const visitId = (response.body as { visitId: number }).visitId;
    const visit = await t.prisma.visit.findUniqueOrThrow({
      where: { id: visitId },
      include: { orders: true, deposits: true, notifications: true },
    });
    expect(visit).toMatchObject({ status: 'issued', version: 1 });
    expect(visit.startDateTime.toISOString()).toBe('2026-12-20T10:07:00.000Z');
    expect(visit.orders).toHaveLength(1);
    expect(visit.orders[0]).toMatchObject({
      status: 'issued',
      tagStatus: 'not_required',
      prepaymentAmount: 0,
      finalPayment: 1500,
    });
    expect(visit.deposits).toHaveLength(1);
    expect(visit.deposits[0]).toMatchObject({
      type: 'cash',
      amount: 3000,
      returned: false,
    });
    expect(visit.notifications).toHaveLength(0);
    expect(t.notificationQueue.add).not.toHaveBeenCalled();
    expect(t.whatsapp.sendMessage).not.toHaveBeenCalled();
    expect(await t.redis.get(`visit_code_lock:${body.visitCode}`)).toBeNull();
    const notWritten = await api.get('/visits/not_written').expect(200);
    expect(
      (notWritten.body as { items: { visitCode: string }[] }).items.map(
        (item) => item.visitCode,
      ),
    ).not.toContain(body.visitCode);

    const actor = await t.prisma.user.findUniqueOrThrow({
      where: { login: t.user.login },
    });
    const events = await t.prisma.auditEvent.findMany({
      where: { visitId },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
    });
    expect(events.map((event) => event.action)).toEqual([
      'visit.created',
      'visit.issued',
      'money.received',
    ]);
    expect(events.every((event) => event.actorUserId === actor.id)).toBe(true);
    expect(
      events.every((event) => event.actorNameSnapshot === actor.name),
    ).toBe(true);

    await api
      .post('/visits/quick-issue')
      .send(body)
      .expect(201)
      .then((replayed) => expect(replayed.body).toEqual(response.body));
    expect(
      await t.prisma.visit.count({ where: { visitCode: body.visitCode } }),
    ).toBe(1);
    expect(
      await t.prisma.visitMoneyOperation.count({ where: { visitId } }),
    ).toBe(1);
    expect(await t.prisma.auditEvent.count({ where: { visitId } })).toBe(3);

    await api
      .post('/visits/quick-issue')
      .send({ ...body, additionalPayment: 2000 })
      .expect(409);
  });

  it('reports an expired preview code with a stable error code', async () => {
    const ids = await seedBooking();
    const body = quickIssueBody(ids, await reservedCode());
    await t.redis.del(`visit_code_lock:${body.visitCode}`);
    const response = await api
      .post('/visits/quick-issue')
      .send(body)
      .expect(409);
    expect(response.body).toMatchObject({ code: 'QUICK_ISSUE_CODE_EXPIRED' });
    expect(
      await t.prisma.visit.count({ where: { visitCode: body.visitCode } }),
    ).toBe(0);
  });

  it('atomically rejects blacklisted clients, foreign children, deleted costumes, and duplicate costumes', async () => {
    async function expectNoQuickIssueMutation(
      body: ReturnType<typeof quickIssueBody>,
    ) {
      await api.post('/visits/quick-issue').send(body).expect(400);
      expect(
        await t.prisma.visit.count({ where: { visitCode: body.visitCode } }),
      ).toBe(0);
      expect(
        await t.prisma.commandReceipt.count({
          where: { commandId: body.commandId },
        }),
      ).toBe(0);
    }

    const blacklistedIds = await seedBooking();
    await api
      .post(`/clients/${blacklistedIds.clientId}/blacklist`)
      .send({ blacklistReason: 'не вернула костюм' })
      .expect(201);
    await expectNoQuickIssueMutation(
      quickIssueBody(blacklistedIds, await reservedCode()),
    );

    const ownerIds = await seedBooking();
    const foreignIds = await seedBooking();
    const foreignChild = quickIssueBody(ownerIds, await reservedCode());
    foreignChild.orders[0].childId = foreignIds.childId;
    await expectNoQuickIssueMutation(foreignChild);

    const deletedIds = await seedBooking();
    await api.delete(`/costumes/${deletedIds.costumeId}`).expect(204);
    await expectNoQuickIssueMutation(
      quickIssueBody(deletedIds, await reservedCode()),
    );

    const duplicateIds = await seedBooking();
    const duplicateCostume = quickIssueBody(duplicateIds, await reservedCode());
    duplicateCostume.orders.push({ ...duplicateCostume.orders[0] });
    await expectNoQuickIssueMutation(duplicateCostume);
  });

  it('records zero, partial, and overpayment once and caps historical allocation at rent', async () => {
    const payments = [0, 1200, 7000];
    for (const [index, additionalPayment] of payments.entries()) {
      const ids = await seedBooking();
      const body = quickIssueBody(ids, await reservedCode(), {
        date: `2026-12-${20 + index * 2}`,
        additionalPayment,
      });
      const response = await api
        .post('/visits/quick-issue')
        .send(body)
        .expect(201);
      const visitId = (response.body as { visitId: number }).visitId;
      const order = await t.prisma.order.findFirstOrThrow({
        where: { visitId, deletedAt: null },
      });
      expect(order.finalPayment).toBe(Math.min(additionalPayment, 5000));
      expect(
        await t.prisma.visitMoneyOperation.count({
          where: { visitId, kind: 'issue_payment', voidedAt: null },
        }),
      ).toBe(additionalPayment > 0 ? 1 : 0);
      expect(
        await t.prisma.visitMoneyOperation.findMany({ where: { visitId } }),
      ).toMatchObject(
        additionalPayment > 0
          ? [{ kind: 'issue_payment', amount: additionalPayment }]
          : [],
      );
    }
  });

  it('keeps document and none deposits separate from rent payments', async () => {
    for (const [index, depositType] of (
      ['document', 'none'] as const
    ).entries()) {
      const ids = await seedBooking();
      const body = quickIssueBody(ids, await reservedCode(), {
        date: `2026-12-${String(28 + index * 2).padStart(2, '0')}`,
        additionalPayment: 0,
        depositType,
        depositAmount: 2500,
      });
      const response = await api
        .post('/visits/quick-issue')
        .send(body)
        .expect(201);
      const visitId = (response.body as { visitId: number }).visitId;
      const deposit = await t.prisma.deposit.findFirstOrThrow({
        where: { visitId, deletedAt: null },
      });
      expect(deposit).toMatchObject({
        type: depositType,
        amount: 0,
        returned: false,
      });
      expect(
        await t.prisma.visitMoneyOperation.count({ where: { visitId } }),
      ).toBe(0);
    }
  });

  it('allows a quick-issued visit to complete through the existing return flow', async () => {
    const ids = await seedBooking();
    const body = quickIssueBody(ids, await reservedCode(), {
      date: '2026-12-30',
      additionalPayment: 0,
      depositType: 'none',
      depositAmount: 0,
    });
    const issued = await api.post('/visits/quick-issue').send(body).expect(201);
    const visitId = (issued.body as { visitId: number }).visitId;
    const returned = await api
      .post(`/visits/${visitId}/complete-return`)
      .send({ depositReturned: false })
      .expect(201);
    expect(returned.body).toMatchObject({ visitId, status: 'completed' });
    const visit = await t.prisma.visit.findUniqueOrThrow({
      where: { id: visitId },
      include: { orders: true, deposits: true },
    });
    expect(visit.status).toBe('completed');
    expect(visit.orders[0].status).toBe('returned');
    expect(visit.deposits[0].type).toBe('none');
  });

  it('rejects a costume already occupied at actual start time', async () => {
    const ids = await seedBooking();
    const regularCode = await reservedCode();
    await api
      .post('/visits?sendNotification=false')
      .send({
        clientId: ids.clientId,
        visitCode: regularCode,
        startDateTime: '2026-12-20',
        endDateTime: '2026-12-20',
        issueTimeFrom: '09:00',
        issueTimeTo: '09:00',
        returnTimeUntil: '11:00',
        orders: [
          {
            childId: ids.childId,
            costumeId: ids.costumeId,
            rentPrice: 5000,
            prepaymentAmount: 0,
          },
        ],
      })
      .expect(201);
    const occupied = quickIssueBody(ids, await reservedCode());
    await api.post('/visits/quick-issue').send(occupied).expect(400);
  });

  it('serializes a quick issue against an ordinary booking for the same costume', async () => {
    const ids = await seedBooking();
    const [regularCode, quickCode] = await Promise.all([
      reservedCode(),
      reservedCode(),
    ]);
    const regular = api.post('/visits?sendNotification=false').send({
      clientId: ids.clientId,
      visitCode: regularCode,
      startDateTime: '2026-12-20',
      endDateTime: '2026-12-21',
      issueTimeFrom: '10:00',
      issueTimeTo: '19:00',
      returnTimeUntil: '19:00',
      orders: [
        {
          childId: ids.childId,
          costumeId: ids.costumeId,
          rentPrice: 5000,
          prepaymentAmount: 0,
        },
      ],
    });
    const quick = api
      .post('/visits/quick-issue')
      .send(quickIssueBody(ids, quickCode));
    const service = t.app.get(VisitOrderService);
    const checkAvailability = service.isSuitAvailability.bind(service);
    let arrivals = 0;
    let releaseBarrier: () => void = () => undefined;
    const barrier = new Promise<void>((resolve) => {
      releaseBarrier = resolve;
    });
    const availabilitySpy = jest
      .spyOn(service, 'isSuitAvailability')
      .mockImplementation(async (costumeIds, start, end, db) => {
        const conflicts = await checkAvailability(costumeIds, start, end, db);
        arrivals += 1;
        if (arrivals === 2) releaseBarrier();
        if (arrivals <= 2) await barrier;
        return conflicts;
      });
    try {
      const [regularResult, quickResult] = await Promise.all([regular, quick]);
      const successfulCount = [regularResult.status, quickResult.status].filter(
        (status) => status === 201,
      ).length;
      expect(successfulCount).toBe(1);
      expect(arrivals).toBeGreaterThanOrEqual(3);
      expect([400, 409]).toContain(
        regularResult.status === 201
          ? quickResult.status
          : regularResult.status,
      );
      const activeVisits = await t.prisma.visit.findMany({
        where: { clientId: ids.clientId, deletedAt: null },
        include: { orders: { where: { deletedAt: null } } },
      });
      expect(activeVisits).toHaveLength(1);
      expect(activeVisits[0].orders).toHaveLength(1);
    } finally {
      availabilitySpy.mockRestore();
    }
  });

  it('rejects invalid calendar dates and mismatched instant issue times', async () => {
    const ids = await seedBooking();
    const code = await reservedCode();
    const invalidDate = quickIssueBody(ids, code);
    await api
      .post('/visits/quick-issue')
      .send({
        ...invalidDate,
        startDateTime: '2026-02-30',
      })
      .expect(400);
    const nextIds = await seedBooking();
    const nextCode = await reservedCode();
    const invalidTime = quickIssueBody(nextIds, nextCode);
    await api
      .post('/visits/quick-issue')
      .send({
        ...invalidTime,
        issueTimeTo: '10:08',
      })
      .expect(400);
  });

  it('rolls back visit, order, deposit, money, audit, and receipt if audit writing fails', async () => {
    const ids = await seedBooking();
    const body = quickIssueBody(ids, await reservedCode());
    const originalTransaction = t.prisma.$transaction.bind(t.prisma);
    const transactionSpy = jest.spyOn(t.prisma, '$transaction');
    transactionSpy.mockImplementation(
      async (callback: unknown, options?: unknown) => {
        if (typeof callback !== 'function') {
          return originalTransaction(callback as never, options as never);
        }
        return originalTransaction(async (tx) => {
          const txProxy = new Proxy(tx, {
            get(target, property, receiver) {
              if (property === 'auditEvent') {
                const delegate = Reflect.get(target, property, receiver);
                return new Proxy(delegate, {
                  get(delegateTarget, method, delegateReceiver) {
                    if (method === 'create') {
                      return jest
                        .fn()
                        .mockRejectedValue(new Error('audit write failed'));
                    }
                    const value: unknown = Reflect.get(
                      delegateTarget,
                      method,
                      delegateReceiver,
                    );
                    if (typeof value !== 'function') return value;
                    const bound: unknown = value.bind(delegateTarget);
                    return bound;
                  },
                });
              }
              const value: unknown = Reflect.get(target, property, receiver);
              if (typeof value !== 'function') return value;
              const bound: unknown = value.bind(target);
              return bound;
            },
          });
          return (callback as (client: typeof tx) => Promise<unknown>)(txProxy);
        }, options as never);
      },
    );
    try {
      await api.post('/visits/quick-issue').send(body).expect(500);
    } finally {
      transactionSpy.mockRestore();
    }
    expect(
      await t.prisma.visit.count({ where: { visitCode: body.visitCode } }),
    ).toBe(0);
    expect(
      await t.prisma.order.count({ where: { costumeId: ids.costumeId } }),
    ).toBe(0);
    expect(
      await t.prisma.deposit.count({
        where: { visit: { visitCode: body.visitCode } },
      }),
    ).toBe(0);
    expect(
      await t.prisma.visitMoneyOperation.count({
        where: { visit: { visitCode: body.visitCode } },
      }),
    ).toBe(0);
    expect(
      await t.prisma.auditEvent.count({ where: { commandId: body.commandId } }),
    ).toBe(0);
    expect(
      await t.prisma.commandReceipt.count({
        where: { commandId: body.commandId },
      }),
    ).toBe(0);
    expect(await t.redis.get(`visit_code_lock:${body.visitCode}`)).toBe(
      'reserved',
    );
  });

  it('unissue resets only not_required tags to not_written', async () => {
    const ids = await seedBooking();
    const secondCostume = await api
      .post('/costumes')
      .send({ name: 'Второй костюм быстрой выдачи' })
      .expect(201);
    const body = quickIssueBody(ids, await reservedCode(), {
      date: '2026-12-26',
      additionalPayment: 0,
    });
    body.orders.push({
      childId: ids.childId,
      costumeId: (secondCostume.body as { costumeId: number }).costumeId,
      rentPrice: 4000,
      notes: 'Второй заказ',
    });
    const response = await api
      .post('/visits/quick-issue')
      .send(body)
      .expect(201);
    const visitId = (response.body as { visitId: number }).visitId;
    const orders = await t.prisma.order.findMany({
      where: { visitId, deletedAt: null },
      orderBy: { id: 'asc' },
    });
    await t.prisma.order.update({
      where: { id: orders[0].id },
      data: { tagStatus: 'written' },
    });
    await api.post(`/visits/${visitId}/unissue`).expect(204);
    expect(
      await t.prisma.order.findUniqueOrThrow({ where: { id: orders[0].id } }),
    ).toMatchObject({ status: 'reserved', tagStatus: 'written' });
    expect(
      await t.prisma.order.findUniqueOrThrow({ where: { id: orders[1].id } }),
    ).toMatchObject({ status: 'reserved', tagStatus: 'not_written' });
    expect(
      await t.prisma.visit.findUniqueOrThrow({ where: { id: visitId } }),
    ).toMatchObject({
      status: 'reserved',
      version: 2,
    });
    const history = await api
      .get(`/visits/${visitId}/history?limit=100`)
      .expect(200);
    expect(
      (history.body as { items: { action: string }[] }).items.map(
        (item) => item.action,
      ),
    ).toContain('visit.unissued');
  });

  it('requires a valid JWT', async () => {
    const response = await api.post('/visits/preview-code').expect(201);
    const ids = await seedBooking();
    const body = quickIssueBody(ids, response.body as string);
    const unauthenticated = authed(t.app, 'invalid');
    await unauthenticated.post('/visits/quick-issue').send(body).expect(401);
  });
});

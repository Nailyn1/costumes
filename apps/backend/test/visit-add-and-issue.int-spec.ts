import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import { Prisma } from '../src/prisma/generated/client';
import { TestApp, createTestApp } from './support/test-app';
import { authed, login } from './support/http';

describe('add and issue orders in an issued visit (integration)', () => {
  let t: TestApp;
  let api: ReturnType<typeof authed>;
  let nextPhone = 77079100000;

  beforeAll(async () => {
    t = await createTestApp();
    api = authed(t.app, await login(t.app, t.user));
  });

  afterAll(async () => {
    await t.close();
  });

  async function seedIssuedVisit(initialPayment = 2000) {
    const client = await api
      .post('/clients')
      .send({ name: 'Мадина', phone: `+${nextPhone++}` })
      .expect(201);
    const clientId = (client.body as { clientId: number }).clientId;
    const children = await Promise.all(
      ['Алия', 'Нурали'].map((name) =>
        api.post('/children').send({ clientId, name }).expect(201),
      ),
    );
    const costumes = await Promise.all(
      ['Космонавт', 'Рыцарь', 'Фея', 'Дракон'].map((name) =>
        api.post('/costumes').send({ name }).expect(201),
      ),
    );
    const childIds = children.map(
      (response) => (response.body as { childId: number }).childId,
    );
    const costumeIds = costumes.map(
      (response) => (response.body as { costumeId: number }).costumeId,
    );
    const code = await api.post('/visits/preview-code').expect(201);
    const created = await api
      .post('/visits?sendNotification=false')
      .send({
        clientId,
        visitCode: code.body as string,
        startDateTime: '2026-12-20',
        endDateTime: '2026-12-21',
        issueTimeFrom: '10:00',
        issueTimeTo: '19:00',
        returnTimeUntil: '19:00',
        orders: [
          {
            childId: childIds[0],
            costumeId: costumeIds[0],
            rentPrice: 5000,
            prepaymentAmount: 1000,
            notes: 'Старый заказ',
          },
        ],
      })
      .expect(201);
    const visitId = (created.body as { id: number }).id;
    await api
      .post(`/visits/${visitId}/issue`)
      .send({
        additionalPayment: initialPayment,
        deposit: { type: 'cash', amount: 3000 },
      })
      .expect(204);
    const visit = await t.prisma.visit.findUniqueOrThrow({
      where: { id: visitId },
      include: { orders: true, deposits: true },
    });
    return { clientId, childIds, costumeIds, visit };
  }

  async function runAfterBothVisitReads<TLeft, TRight>(
    visitId: number,
    left: () => Promise<TLeft>,
    right: () => Promise<TRight>,
  ): Promise<[TLeft, TRight]> {
    type TransactionOptions = NonNullable<
      Parameters<typeof t.prisma.$transaction>[1]
    >;
    const mutablePrisma = t.prisma as unknown as {
      $transaction: (
        callback: (tx: Prisma.TransactionClient) => Promise<unknown>,
        options?: TransactionOptions,
      ) => Promise<unknown>;
    };
    const originalTransaction = t.prisma.$transaction.bind(t.prisma);
    let reads = 0;
    let release!: () => void;
    const bothReads = new Promise<void>((resolve) => {
      release = resolve;
    });
    mutablePrisma.$transaction = (callback, options) =>
      originalTransaction(async (tx) => {
        const proxiedVisit = new Proxy(tx.visit, {
          get(target, property) {
            if (property === 'findFirst') {
              const findFirst = target.findFirst.bind(target);
              return async (...args: Parameters<typeof target.findFirst>) => {
                const result = await findFirst(...args);
                const requestedId = args[0]?.where?.id;
                if (
                  typeof requestedId !== 'number' ||
                  requestedId !== visitId
                ) {
                  return result;
                }
                reads += 1;
                if (reads === 2) release();
                await bothReads;
                return result;
              };
            }
            const value = Reflect.get(target, property, target) as unknown;
            return typeof value === 'function'
              ? (value.bind(target) as unknown)
              : value;
          },
        });
        const proxiedTx = new Proxy(tx, {
          get(target, property, receiver) {
            if (property === 'visit') return proxiedVisit;
            return Reflect.get(target, property, receiver) as unknown;
          },
        }) as Prisma.TransactionClient;
        return callback(proxiedTx);
      }, options);
    try {
      return await Promise.all([left(), right()]);
    } finally {
      mutablePrisma.$transaction = originalTransaction;
    }
  }

  it('adds multiple orders, preserves old order and deposit, records actual payment, and replays its canonical receipt', async () => {
    const { childIds, costumeIds, visit } = await seedIssuedVisit();
    const oldOrder = visit.orders[0];
    const deposit = visit.deposits[0];
    await api.post(`/visits/${oldOrder.id}/mark-tag-written`).expect(204);
    const oldBefore = await t.prisma.order.findUniqueOrThrow({
      where: { id: oldOrder.id },
    });
    const before = await t.prisma.visit.findUniqueOrThrow({
      where: { id: visit.id },
    });
    const command = {
      commandId: randomUUID(),
      expectedVersion: before.version,
      orders: [
        {
          childId: childIds[1],
          costumeId: costumeIds[1],
          rentPrice: 4000,
          notes: 'Сразу выдать',
        },
        {
          childId: childIds[1],
          costumeId: costumeIds[2],
          rentPrice: 3000,
        },
      ],
      additionalPayment: 4500,
    };
    const queueCallsBefore = t.notificationQueue.add.mock.calls.length;

    const first = await api
      .post(`/visits/${visit.id}/add-and-issue`)
      .send(command)
      .expect(200);
    expect(first.body).toMatchObject({
      id: visit.id,
      status: 'issued',
      version: before.version + 1,
      totals: { totalRent: 12000, totalPrepayment: 1000 },
      balance: { totalReceived: 6500, signedBalance: 4500, debt: 4500 },
    });
    expect(t.notificationQueue.add).toHaveBeenCalledTimes(queueCallsBefore);
    const orders = first.body as {
      orders: {
        orderId: number;
        costumeId: number;
        status: string;
        tagStatus: string;
        prepaymentAmount: number;
        finalPayment?: number;
      }[];
    };
    expect(orders.orders).toHaveLength(3);
    const addedOne = orders.orders.find(
      (order) => order.costumeId === costumeIds[1],
    );
    const addedTwo = orders.orders.find(
      (order) => order.costumeId === costumeIds[2],
    );
    expect(addedOne).toMatchObject({
      status: 'issued',
      tagStatus: 'not_required',
      prepaymentAmount: 0,
      finalPayment: 4000,
    });
    expect(addedTwo).toMatchObject({
      status: 'issued',
      tagStatus: 'not_required',
      prepaymentAmount: 0,
      finalPayment: 500,
    });
    if (!addedOne || !addedTwo) {
      throw new Error('Expected both added orders in canonical visit detail');
    }
    const addedOneInDatabase = await t.prisma.order.findUniqueOrThrow({
      where: { id: addedOne.orderId },
    });
    expect(addedOneInDatabase).toMatchObject({
      startDateTime: visit.startDateTime,
      endDateTime: visit.endDateTime,
    });
    const notWritten = await api.get('/visits/not_written').expect(200);
    expect(
      (notWritten.body as { items: { orderId: number }[] }).items.map(
        (order) => order.orderId,
      ),
    ).not.toContain(addedOne.orderId);
    expect(
      (notWritten.body as { items: { orderId: number }[] }).items.map(
        (order) => order.orderId,
      ),
    ).not.toContain(addedTwo.orderId);
    const oldAfter = await t.prisma.order.findUniqueOrThrow({
      where: { id: oldOrder.id },
    });
    expect(oldAfter).toMatchObject({
      status: oldBefore.status,
      finalPayment: oldBefore.finalPayment,
      prepaymentAmount: oldBefore.prepaymentAmount,
      rentPrice: oldBefore.rentPrice,
      notes: oldBefore.notes,
      tagStatus: 'written',
    });
    expect(
      await t.prisma.deposit.findUniqueOrThrow({ where: { id: deposit.id } }),
    ).toMatchObject({
      type: deposit.type,
      amount: deposit.amount,
      returned: deposit.returned,
      deletedAt: null,
    });
    expect(
      await t.prisma.visitMoneyOperation.count({
        where: { visitId: visit.id, kind: 'issue_payment', voidedAt: null },
      }),
    ).toBe(2);
    const events = await t.prisma.auditEvent.findMany({
      where: { visitId: visit.id, commandId: command.commandId },
      orderBy: { id: 'asc' },
    });
    expect(events.map((event) => event.action)).toEqual([
      'orders.added_and_issued',
      'money.received',
    ]);
    const eventPayload = events[0].payload;
    if (
      !eventPayload ||
      Array.isArray(eventPayload) ||
      typeof eventPayload !== 'object' ||
      !Array.isArray(eventPayload.orders)
    ) {
      throw new Error(
        'Expected add-and-issue order snapshots in audit payload',
      );
    }
    const auditedCostumeIds = eventPayload.orders.flatMap((order) =>
      order &&
      typeof order === 'object' &&
      'costumeId' in order &&
      typeof order.costumeId === 'number'
        ? [order.costumeId]
        : [],
    );
    expect(auditedCostumeIds.sort()).toEqual(
      [costumeIds[1], costumeIds[2]].sort(),
    );

    await t.redis.flushdb();
    const replay = await api
      .post(`/visits/${visit.id}/add-and-issue`)
      .send(command)
      .expect(200);
    expect(replay.body).toEqual(first.body);
    expect(
      await t.prisma.order.count({
        where: { visitId: visit.id, deletedAt: null },
      }),
    ).toBe(3);
    await api
      .post(`/visits/${visit.id}/add-and-issue`)
      .send({ ...command, additionalPayment: command.additionalPayment + 1 })
      .expect(409);
    const secondActor = {
      login: `t096-${nextPhone}`,
      password: 'test-add-and-issue-password',
    };
    await t.prisma.user.create({
      data: {
        login: secondActor.login,
        name: 'Другой сотрудник',
        password: await argon2.hash(secondActor.password, {
          type: argon2.argon2id,
        }),
      },
    });
    const secondApi = authed(t.app, await login(t.app, secondActor));
    await secondApi
      .post(`/visits/${visit.id}/add-and-issue`)
      .send(command)
      .expect(409);
  });

  it('rejects stale versions, old costumes, repeated new costumes, and conflicting availability', async () => {
    const { childIds, costumeIds, visit } = await seedIssuedVisit();
    const request = {
      commandId: randomUUID(),
      expectedVersion: visit.version,
      orders: [
        {
          childId: childIds[1],
          costumeId: costumeIds[1],
          rentPrice: 1000,
        },
      ],
      additionalPayment: 0,
    };
    await api
      .post(`/visits/${visit.id}/add-and-issue`)
      .send({ ...request, expectedVersion: visit.version - 1 })
      .expect(409)
      .then((response) =>
        expect(response.body).toMatchObject({ code: 'VISIT_VERSION_CONFLICT' }),
      );
    await api
      .post(`/visits/${visit.id}/add-and-issue`)
      .send({
        ...request,
        orders: [
          { ...request.orders[0], costumeId: costumeIds[0] },
          { ...request.orders[0], costumeId: costumeIds[1] },
        ],
      })
      .expect(400);
    await api
      .post(`/visits/${visit.id}/add-and-issue`)
      .send({
        ...request,
        orders: [
          request.orders[0],
          { ...request.orders[0], childId: childIds[0] },
        ],
      })
      .expect(400);

    const otherClient = await api
      .post('/clients')
      .send({ name: 'Сауле', phone: `+${nextPhone++}` })
      .expect(201);
    const otherClientId = (otherClient.body as { clientId: number }).clientId;
    const otherChild = await api
      .post('/children')
      .send({ clientId: otherClientId, name: 'Ержан' })
      .expect(201);
    const competingCostume = await api
      .post('/costumes')
      .send({ name: 'Костюм для конфликта' })
      .expect(201);
    const competingCostumeId = (competingCostume.body as { costumeId: number })
      .costumeId;
    const code = await api.post('/visits/preview-code').expect(201);
    await api
      .post('/visits?sendNotification=false')
      .send({
        clientId: otherClientId,
        visitCode: code.body as string,
        startDateTime: '2026-12-20',
        endDateTime: '2026-12-21',
        issueTimeFrom: '10:00',
        issueTimeTo: '19:00',
        returnTimeUntil: '19:00',
        orders: [
          {
            childId: (otherChild.body as { childId: number }).childId,
            costumeId: competingCostumeId,
            rentPrice: 5000,
            prepaymentAmount: 0,
          },
        ],
      })
      .expect(201);
    await api
      .post(`/visits/${visit.id}/add-and-issue`)
      .send({
        ...request,
        orders: [{ ...request.orders[0], costumeId: competingCostumeId }],
      })
      .expect(400);

    const otherChildId = (otherChild.body as { childId: number }).childId;
    await api
      .post(`/visits/${visit.id}/add-and-issue`)
      .send({
        ...request,
        orders: [{ ...request.orders[0], childId: otherChildId }],
      })
      .expect(400);
    await t.prisma.child.update({
      where: { id: childIds[1] },
      data: { deletedAt: new Date() },
    });
    await api
      .post(`/visits/${visit.id}/add-and-issue`)
      .send({
        ...request,
        orders: [
          {
            ...request.orders[0],
            childId: childIds[1],
            costumeId: costumeIds[3],
          },
        ],
      })
      .expect(400);
    await t.prisma.costume.update({
      where: { id: costumeIds[3] },
      data: { deletedAt: new Date() },
    });
    await api
      .post(`/visits/${visit.id}/add-and-issue`)
      .send({
        ...request,
        orders: [
          {
            ...request.orders[0],
            childId: childIds[0],
            costumeId: costumeIds[3],
          },
        ],
      })
      .expect(400);
    await t.prisma.client.update({
      where: { id: visit.clientId },
      data: { isBlacklisted: true },
    });
    await api
      .post(`/visits/${visit.id}/add-and-issue`)
      .send({ ...request, orders: [{ ...request.orders[0] }] })
      .expect(400);
    await t.prisma.client.update({
      where: { id: visit.clientId },
      data: { deletedAt: new Date() },
    });
    await api
      .post(`/visits/${visit.id}/add-and-issue`)
      .send({ ...request, orders: [{ ...request.orders[0] }] })
      .expect(404);
  });

  it('keeps old allocations while recording an overpayment in the whole-visit balance', async () => {
    const { childIds, costumeIds, visit } = await seedIssuedVisit();
    const old = visit.orders[0];
    const response = await api
      .post(`/visits/${visit.id}/add-and-issue`)
      .send({
        commandId: randomUUID(),
        expectedVersion: visit.version,
        orders: [
          { childId: childIds[1], costumeId: costumeIds[1], rentPrice: 2500 },
        ],
        additionalPayment: 10000,
      })
      .expect(200);
    expect(response.body).toMatchObject({
      balance: {
        totalRent: 7500,
        totalPrepayment: 1000,
        totalReceived: 12000,
        signedBalance: -5500,
        refundDue: 5500,
      },
    });
    expect(
      await t.prisma.order.findUniqueOrThrow({ where: { id: old.id } }),
    ).toMatchObject({
      finalPayment: old.finalPayment,
      prepaymentAmount: old.prepaymentAmount,
      rentPrice: old.rentPrice,
    });
    expect(
      await t.prisma.visitMoneyOperation.findFirstOrThrow({
        where: {
          visitId: visit.id,
          kind: 'issue_payment',
          amount: 10000,
          voidedAt: null,
        },
      }),
    ).toBeTruthy();
  });

  it('records zero payment and returns every order', async () => {
    const { childIds, costumeIds, visit } = await seedIssuedVisit(10000);
    const response = await api
      .post(`/visits/${visit.id}/add-and-issue`)
      .send({
        commandId: randomUUID(),
        expectedVersion: visit.version,
        orders: [
          { childId: childIds[1], costumeId: costumeIds[1], rentPrice: 2500 },
        ],
        additionalPayment: 0,
      })
      .expect(200);
    expect(response.body).toMatchObject({
      balance: { totalReceived: 10000, signedBalance: -3500, refundDue: 3500 },
    });
    const added = await t.prisma.order.findFirstOrThrow({
      where: { visitId: visit.id, costumeId: costumeIds[1], deletedAt: null },
    });
    expect(added).toMatchObject({
      status: 'issued',
      tagStatus: 'not_required',
      finalPayment: 0,
      prepaymentAmount: 0,
    });
    expect(
      await t.prisma.visitMoneyOperation.count({
        where: { visitId: visit.id, kind: 'issue_payment', voidedAt: null },
      }),
    ).toBe(1);

    await api
      .post(`/visits/${visit.id}/complete-return`)
      .send({ depositReturned: false })
      .expect(201);
    expect(
      await t.prisma.order.findMany({
        where: { visitId: visit.id, deletedAt: null },
      }),
    ).toHaveLength(2);
    expect(
      await t.prisma.order.count({
        where: { visitId: visit.id, status: 'returned', deletedAt: null },
      }),
    ).toBe(2);
    const completed = await t.prisma.visit.findUniqueOrThrow({
      where: { id: visit.id },
    });
    await api
      .post(`/visits/${visit.id}/add-and-issue`)
      .send({
        commandId: randomUUID(),
        expectedVersion: completed.version,
        orders: [
          { childId: childIds[1], costumeId: costumeIds[2], rentPrice: 2500 },
        ],
        additionalPayment: 0,
      })
      .expect(400);
  });

  it('fully unissues all issue payments, resets new tag state, and preserves written old tags', async () => {
    const { childIds, costumeIds, visit } = await seedIssuedVisit();
    const oldOrder = visit.orders[0];
    await api.post(`/visits/${oldOrder.id}/mark-tag-written`).expect(204);
    const issued = await t.prisma.visit.findUniqueOrThrow({
      where: { id: visit.id },
    });
    await api
      .post(`/visits/${visit.id}/add-and-issue`)
      .send({
        commandId: randomUUID(),
        expectedVersion: issued.version,
        orders: [
          { childId: childIds[1], costumeId: costumeIds[1], rentPrice: 2500 },
        ],
        additionalPayment: 1000,
      })
      .expect(200);
    const added = await t.prisma.order.findFirstOrThrow({
      where: { visitId: visit.id, costumeId: costumeIds[1], deletedAt: null },
    });
    await api.post(`/visits/${visit.id}/unissue`).expect(204);
    expect(
      await t.prisma.order.findUniqueOrThrow({ where: { id: oldOrder.id } }),
    ).toMatchObject({ status: 'reserved', tagStatus: 'written' });
    expect(
      await t.prisma.order.findUniqueOrThrow({ where: { id: added.id } }),
    ).toMatchObject({ status: 'reserved', tagStatus: 'not_written' });
    expect(
      await t.prisma.visitMoneyOperation.findMany({
        where: { visitId: visit.id, kind: 'issue_payment' },
      }),
    ).toHaveLength(2);
    expect(
      await t.prisma.visitMoneyOperation.count({
        where: { visitId: visit.id, kind: 'issue_payment', voidedAt: null },
      }),
    ).toBe(0);
    const deletedDeposit = await t.prisma.deposit.findFirstOrThrow({
      where: { visitId: visit.id },
    });
    expect(deletedDeposit.deletedAt).toBeInstanceOf(Date);
    const unissuedVisit = await t.prisma.visit.findUniqueOrThrow({
      where: { id: visit.id },
    });
    await api
      .post(`/visits/${visit.id}/add-and-issue`)
      .send({
        commandId: randomUUID(),
        expectedVersion: unissuedVisit.version,
        orders: [
          { childId: childIds[1], costumeId: costumeIds[2], rentPrice: 2500 },
        ],
        additionalPayment: 0,
      })
      .expect(400);
  });

  it.each(['return', 'unissue'] as const)(
    'serializes add-and-issue against %s without leaving mixed order states',
    async (competingAction) => {
      const { childIds, costumeIds, visit } = await seedIssuedVisit();
      const command = {
        commandId: randomUUID(),
        expectedVersion: visit.version,
        orders: [
          { childId: childIds[1], costumeId: costumeIds[1], rentPrice: 2500 },
        ],
        additionalPayment: 0,
      };
      const [addResult, competingResult] = await runAfterBothVisitReads(
        visit.id,
        () => api.post(`/visits/${visit.id}/add-and-issue`).send(command),
        () => {
          if (competingAction === 'return') {
            return api
              .post(`/visits/${visit.id}/complete-return`)
              .send({ depositReturned: false });
          }
          return api.post(`/visits/${visit.id}/unissue`);
        },
      );
      expect([200, 400, 409]).toContain(addResult.status);
      expect(
        competingAction === 'return' ? [201, 400, 409] : [204, 400, 409],
      ).toContain(competingResult.status);
      const final = await t.prisma.visit.findUniqueOrThrow({
        where: { id: visit.id },
        include: { orders: { where: { deletedAt: null } } },
      });
      if (final.status === 'completed') {
        expect(final.orders.length).toBeGreaterThanOrEqual(1);
        expect(final.orders.every((order) => order.status === 'returned')).toBe(
          true,
        );
      } else if (final.status === 'reserved') {
        expect(final.orders.every((order) => order.status === 'reserved')).toBe(
          true,
        );
      } else {
        expect(final.status).toBe('issued');
        expect(final.orders.every((order) => order.status === 'issued')).toBe(
          true,
        );
      }
    },
  );

  it('rolls back new orders, payment, version, receipt, and audit when history insertion fails', async () => {
    const { childIds, costumeIds, visit } = await seedIssuedVisit();
    const commandId = randomUUID();
    await t.prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION reject_test_add_issue_audit() RETURNS trigger AS $$
      BEGIN
        IF NEW.action = 'orders.added_and_issued' THEN
          RAISE EXCEPTION 'forced audit failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await t.prisma.$executeRawUnsafe(`
      CREATE TRIGGER reject_test_add_issue_audit
      BEFORE INSERT ON audit_events
      FOR EACH ROW EXECUTE FUNCTION reject_test_add_issue_audit();
    `);
    try {
      await api
        .post(`/visits/${visit.id}/add-and-issue`)
        .send({
          commandId,
          expectedVersion: visit.version,
          orders: [
            { childId: childIds[1], costumeId: costumeIds[1], rentPrice: 4000 },
          ],
          additionalPayment: 1200,
        })
        .expect(500);
    } finally {
      await t.prisma.$executeRawUnsafe(
        'DROP TRIGGER IF EXISTS reject_test_add_issue_audit ON audit_events',
      );
      await t.prisma.$executeRawUnsafe(
        'DROP FUNCTION IF EXISTS reject_test_add_issue_audit()',
      );
    }
    expect(
      await t.prisma.visit.findUniqueOrThrow({ where: { id: visit.id } }),
    ).toMatchObject({ version: visit.version, status: 'issued' });
    expect(
      await t.prisma.order.count({
        where: { visitId: visit.id, deletedAt: null },
      }),
    ).toBe(1);
    expect(
      await t.prisma.visitMoneyOperation.count({
        where: { visitId: visit.id },
      }),
    ).toBe(1);
    expect(
      await t.prisma.commandReceipt.findUnique({ where: { commandId } }),
    ).toBeNull();
  });
});

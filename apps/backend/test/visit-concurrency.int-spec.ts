import { randomUUID } from 'node:crypto';
import type { Prisma } from '../src/prisma/generated/client';
import type { PrismaService } from '../src/prisma/prisma.service';
import {
  executeWithCommandReceipt,
  hashCommandRequest,
} from '../src/visit-order/transactions/command-receipt';
import { VisitOrderService } from '../src/visit-order/visit-order.service';
import { TestApp, createTestApp } from './support/test-app';
import { authed, login } from './support/http';

describe('visit concurrency (integration)', () => {
  let t: TestApp;
  let api: ReturnType<typeof authed>;

  beforeAll(async () => {
    t = await createTestApp();
    api = authed(t.app, await login(t.app, t.user));
  });

  afterAll(async () => {
    await t.close();
  });

  it('rechecks costume availability after a serialization retry', async () => {
    const client = await api
      .post('/clients')
      .send({ name: 'Алия', phone: '+77071110098' })
      .expect(201);
    const clientId = (client.body as { clientId: number }).clientId;
    const child = await api
      .post('/children')
      .send({ clientId, name: 'Маша' })
      .expect(201);
    const costume = await api
      .post('/costumes')
      .send({ name: 'Эльза' })
      .expect(201);
    const childId = (child.body as { childId: number }).childId;
    const costumeId = (costume.body as { costumeId: number }).costumeId;
    const codes = await Promise.all([reserveVisitCode(), reserveVisitCode()]);

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
      const responses = await Promise.all(
        codes.map((visitCode) =>
          api.post('/visits?sendNotification=false').send({
            clientId,
            visitCode,
            startDateTime: '2026-12-20',
            endDateTime: '2026-12-21',
            issueTimeFrom: '10:00',
            issueTimeTo: '19:00',
            returnTimeUntil: '19:00',
            orders: [
              {
                childId,
                costumeId,
                rentPrice: 5000,
                prepaymentAmount: 1000,
              },
            ],
          }),
        ),
      );

      expect(responses.map((response) => response.status).sort()).toEqual([
        201, 400,
      ]);
      expect(arrivals).toBeGreaterThanOrEqual(3);

      const visits = await t.prisma.visit.findMany({
        where: { clientId, deletedAt: null },
        include: { orders: { where: { deletedAt: null } } },
      });
      expect(visits).toHaveLength(1);
      expect(visits[0].version).toBe(1);
      expect(visits[0].orders).toHaveLength(1);
      expect(
        await t.prisma.order.count({
          where: { costumeId, deletedAt: null, status: 'reserved' },
        }),
      ).toBe(1);

      const actor = await t.prisma.user.findUniqueOrThrow({
        where: { login: t.user.login },
      });
      const creationEvents = await t.prisma.auditEvent.findMany({
        where: { action: 'visit.created', visitId: visits[0].id },
      });
      expect(creationEvents).toHaveLength(1);
      expect(creationEvents[0]).toMatchObject({
        actorUserId: actor.id,
        actorNameSnapshot: actor.name,
        source: 'user',
      });
    } finally {
      availabilitySpy.mockRestore();
    }

    async function reserveVisitCode(): Promise<string> {
      const response = await api.post('/visits/preview-code').expect(201);
      return response.body as string;
    }
  });

  it('serializes concurrent issue and cancellation without partial writes', async () => {
    const visitId = await createReservedVisit('+77071110101');
    const barrier = installVisitFindFirstBarrier(t.prisma, 2);

    let issueResponse: Awaited<ReturnType<typeof api.post>>;
    let cancelResponse: Awaited<ReturnType<typeof api.post>>;
    try {
      [issueResponse, cancelResponse] = await Promise.all([
        api.post(`/visits/${visitId}/issue`).send({
          additionalPayment: 1000,
          deposit: { type: 'cash', amount: 5000 },
        }),
        api.post(`/visits/${visitId}/cancel`).send({ reason: 'race test' }),
      ]);
    } finally {
      barrier.restore();
    }

    expect(barrier.arrivals()).toBeGreaterThanOrEqual(3);
    expect([issueResponse.status, cancelResponse.status].sort()).toEqual([
      204,
      expect.any(Number),
    ]);
    expect(
      [issueResponse.status, cancelResponse.status].filter(
        (status) => status >= 400 && status < 500,
      ),
    ).toHaveLength(1);

    const visit = await t.prisma.visit.findUniqueOrThrow({
      where: { id: visitId },
      include: {
        orders: { where: { deletedAt: null } },
        deposits: { where: { deletedAt: null } },
        moneyOperations: { where: { voidedAt: null } },
      },
    });
    const auditEvents = await t.prisma.auditEvent.findMany({
      where: { visitId, action: { in: ['visit.issued', 'visit.cancelled'] } },
    });
    expect(visit.version).toBe(2);
    expect(visit.orders).toHaveLength(1);
    expect(auditEvents).toHaveLength(1);

    if (issueResponse.status === 204) {
      expect(visit).toMatchObject({ status: 'issued' });
      expect(visit.orders[0].status).toBe('issued');
      expect(visit.deposits).toHaveLength(1);
      expect(visit.moneyOperations).toMatchObject([
        { kind: 'issue_payment', amount: 1000 },
      ]);
      expect(auditEvents[0].action).toBe('visit.issued');
    } else {
      expect(cancelResponse.status).toBe(204);
      expect(visit).toMatchObject({ status: 'cancelled' });
      expect(visit.orders[0].status).toBe('cancelled');
      expect(visit.deposits).toHaveLength(0);
      expect(visit.moneyOperations).toHaveLength(0);
      expect(auditEvents[0].action).toBe('visit.cancelled');
    }
  });

  it('serializes concurrent return and unissue without partial writes', async () => {
    const visitId = await createReservedVisit('+77071110102');
    await api
      .post(`/visits/${visitId}/issue`)
      .send({
        additionalPayment: 1000,
        deposit: { type: 'cash', amount: 5000 },
      })
      .expect(204);

    const barrier = installVisitFindFirstBarrier(t.prisma, 2);
    let returnResponse: Awaited<ReturnType<typeof api.post>>;
    let unissueResponse: Awaited<ReturnType<typeof api.post>>;
    try {
      [returnResponse, unissueResponse] = await Promise.all([
        api
          .post(`/visits/${visitId}/complete-return`)
          .send({ depositReturned: true, notes: 'race test' }),
        api.post(`/visits/${visitId}/unissue`).send({}),
      ]);
    } finally {
      barrier.restore();
    }

    expect(barrier.arrivals()).toBeGreaterThanOrEqual(3);
    expect(
      [returnResponse.status, unissueResponse.status].filter((status) =>
        [201, 204].includes(status),
      ),
    ).toHaveLength(1);
    expect(
      [returnResponse.status, unissueResponse.status].filter(
        (status) => status >= 400 && status < 500,
      ),
    ).toHaveLength(1);

    const visit = await t.prisma.visit.findUniqueOrThrow({
      where: { id: visitId },
      include: {
        orders: { where: { deletedAt: null } },
        deposits: { where: { deletedAt: null } },
        moneyOperations: { where: { kind: 'issue_payment' } },
      },
    });
    const eventActions = await t.prisma.auditEvent.findMany({
      where: {
        visitId,
        action: { in: ['visit.unissued', 'visit.completed'] },
      },
      select: { action: true },
    });
    expect(visit.version).toBe(3);
    expect(visit.orders).toHaveLength(1);
    expect(visit.moneyOperations).toHaveLength(1);

    if (returnResponse.status === 201) {
      expect(visit.status).toBe('completed');
      expect(visit.orders[0].status).toBe('returned');
      expect(visit.deposits).toMatchObject([{ returned: true }]);
      expect(visit.moneyOperations[0].voidedAt).toBeNull();
      expect(eventActions).toEqual([{ action: 'visit.completed' }]);
    } else {
      expect(unissueResponse.status).toBe(204);
      expect(visit.status).toBe('reserved');
      expect(visit.orders[0].status).toBe('reserved');
      expect(visit.deposits).toHaveLength(0);
      expect(visit.moneyOperations[0].voidedAt).not.toBeNull();
      expect(eventActions).toEqual([{ action: 'visit.unissued' }]);
    }
  });

  it('stores receipt and business payment atomically across concurrent calls and Redis loss', async () => {
    const visitId = await createReservedVisit('+77071110103');
    const actor = await t.prisma.user.findUniqueOrThrow({
      where: { login: t.user.login },
    });
    const request = { visitId, amount: 1200 };
    const identity = {
      commandId: randomUUID(),
      actorUserId: actor.id,
      commandPath: 'integration/issue-payment',
      requestHash: hashCommandRequest(request),
    };
    let operationCalls = 0;
    let releaseBarrier: () => void = () => undefined;
    const barrier = new Promise<void>((resolve) => {
      releaseBarrier = resolve;
    });
    const command = () =>
      executeWithCommandReceipt(
        t.prisma,
        identity,
        async (tx) => {
          operationCalls += 1;
          const payment = await tx.visitMoneyOperation.create({
            data: { visitId, kind: 'issue_payment', amount: 1200 },
          });
          if (operationCalls === 2) releaseBarrier();
          if (operationCalls <= 2) await barrier;
          return { id: payment.id, amount: payment.amount };
        },
        parsePaymentResult,
      );

    const [first, second] = await Promise.all([command(), command()]);
    expect(first).toEqual(second);
    expect(operationCalls).toBeGreaterThanOrEqual(2);
    expect(
      await t.prisma.visitMoneyOperation.count({ where: { visitId } }),
    ).toBe(1);
    expect(
      await t.prisma.commandReceipt.count({
        where: { commandId: identity.commandId },
      }),
    ).toBe(1);

    const callsBeforeReplay = operationCalls;
    await t.redis.flushdb();
    const replay = await command();
    expect(replay).toEqual(first);
    expect(
      await t.prisma.visitMoneyOperation.count({ where: { visitId } }),
    ).toBe(1);
    expect(operationCalls).toBe(callsBeforeReplay);

    const invalidIdentity = {
      ...identity,
      commandId: randomUUID(),
    };
    await expect(
      executeWithCommandReceipt<unknown>(
        t.prisma,
        invalidIdentity,
        async (tx) => {
          await tx.visitMoneyOperation.create({
            data: { visitId, kind: 'issue_payment', amount: 300 },
          });
          return { id: 'invalid', amount: 300 };
        },
        parsePaymentResult,
      ),
    ).rejects.toThrow('Invalid payment receipt result');

    const auditFailureIdentity = {
      ...identity,
      commandId: randomUUID(),
    };
    await expect(
      executeWithCommandReceipt(
        t.prisma,
        auditFailureIdentity,
        async (tx) => {
          await tx.visitMoneyOperation.create({
            data: { visitId, kind: 'issue_payment', amount: 400 },
          });
          await tx.auditEvent.create({
            data: {
              actorUserId: actor.id + 1_000_000,
              actorNameSnapshot: actor.name,
              source: 'user',
              action: 'money.received',
              entityType: 'visit',
              entityId: visitId,
              visitId,
              commandId: auditFailureIdentity.commandId,
              payload: { kind: 'money.received', amount: 400 },
            },
          });
          return { id: 1, amount: 400 };
        },
        parsePaymentResult,
      ),
    ).rejects.toThrow();

    expect(
      await t.prisma.visitMoneyOperation.count({ where: { visitId } }),
    ).toBe(1);
    expect(
      await t.prisma.commandReceipt.count({
        where: {
          commandId: {
            in: [invalidIdentity.commandId, auditFailureIdentity.commandId],
          },
        },
      }),
    ).toBe(0);
    expect(
      await t.prisma.auditEvent.count({
        where: {
          visitId,
          commandId: auditFailureIdentity.commandId,
        },
      }),
    ).toBe(0);
  });

  async function createReservedVisit(phone: string): Promise<number> {
    const client = await api
      .post('/clients')
      .send({ name: 'Тестовый клиент', phone })
      .expect(201);
    const clientId = (client.body as { clientId: number }).clientId;
    const child = await api
      .post('/children')
      .send({ clientId, name: 'Тестовый ребёнок' })
      .expect(201);
    const costume = await api
      .post('/costumes')
      .send({ name: `Тестовый костюм ${phone}` })
      .expect(201);
    const visitCodeResponse = await api
      .post('/visits/preview-code')
      .expect(201);
    const visitCode = visitCodeResponse.body as string;
    await api
      .post('/visits?sendNotification=false')
      .send({
        clientId,
        visitCode,
        startDateTime: '2026-12-20',
        endDateTime: '2026-12-21',
        issueTimeFrom: '10:00',
        issueTimeTo: '19:00',
        returnTimeUntil: '19:00',
        orders: [
          {
            childId: (child.body as { childId: number }).childId,
            costumeId: (costume.body as { costumeId: number }).costumeId,
            rentPrice: 5000,
            prepaymentAmount: 1000,
          },
        ],
      })
      .expect(201);
    const visit = await t.prisma.visit.findUniqueOrThrow({
      where: { visitCode },
    });
    return visit.id;
  }
});

function parsePaymentResult(value: Prisma.JsonValue): {
  id: number;
  amount: number;
} {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    typeof value.id !== 'number' ||
    typeof value.amount !== 'number'
  ) {
    throw new Error('Invalid payment receipt result');
  }
  return { id: value.id, amount: value.amount };
}

function installVisitFindFirstBarrier(
  prisma: PrismaService,
  participants: number,
): { arrivals: () => number; restore: () => void } {
  const originalTransaction = prisma.$transaction.bind(prisma);
  const transactionSpy = jest.spyOn(prisma, '$transaction');
  let arrivals = 0;
  let releaseBarrier: () => void = () => undefined;
  const barrier = new Promise<void>((resolve) => {
    releaseBarrier = resolve;
  });

  const implementation = async (
    input: unknown,
    options?: unknown,
  ): Promise<unknown> => {
    if (typeof input !== 'function') {
      return originalTransaction(input as never, options as never);
    }
    return originalTransaction(async (tx) => {
      const wrappedTx = new Proxy(tx, {
        get(target, property) {
          const model = Reflect.get(target, property, target) as unknown;
          if (
            property !== 'visit' ||
            typeof model !== 'object' ||
            model === null
          ) {
            return model;
          }
          return new Proxy(model, {
            get(visitModel, method) {
              const value = Reflect.get(
                visitModel,
                method,
                visitModel,
              ) as unknown;
              if (method !== 'findFirst' || typeof value !== 'function') {
                return typeof value === 'function'
                  ? (value as (...args: unknown[]) => unknown).bind(visitModel)
                  : value;
              }
              return async (...args: unknown[]) => {
                const invoke = value as (...args: unknown[]) => unknown;
                const result: unknown = await invoke.apply(visitModel, args);
                arrivals += 1;
                if (arrivals === participants) releaseBarrier();
                if (arrivals <= participants) await barrier;
                return result;
              };
            },
          });
        },
      }) as Prisma.TransactionClient;
      const callback = input as (
        transaction: Prisma.TransactionClient,
      ) => Promise<unknown>;
      return callback(wrappedTx);
    }, options as never);
  };

  transactionSpy.mockImplementation(implementation);
  return {
    arrivals: () => arrivals,
    restore: () => transactionSpy.mockRestore(),
  };
}

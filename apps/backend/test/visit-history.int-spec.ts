import { TestApp, createTestApp } from './support/test-app';
import { authed, login } from './support/http';

interface CreatedVisit {
  visitId: number;
  visitCode: string;
}

describe('visit audit history (integration)', () => {
  let t: TestApp;
  let api: ReturnType<typeof authed>;
  let nextPhone = 77079990000;

  beforeAll(async () => {
    t = await createTestApp();
    api = authed(t.app, await login(t.app, t.user));
  });

  afterAll(async () => {
    await t.close();
  });

  async function createVisit(): Promise<CreatedVisit & { orderId: number }> {
    const client = await api
      .post('/clients')
      .send({ name: 'Клиент истории', phone: `+${nextPhone++}` })
      .expect(201);
    const clientId = (client.body as { clientId: number }).clientId;
    const child = await api
      .post('/children')
      .send({ clientId, name: 'Ребёнок истории' })
      .expect(201);
    const childId = (child.body as { childId: number }).childId;
    const costume = await api
      .post('/costumes')
      .send({ name: 'Костюм истории' })
      .expect(201);
    const costumeId = (costume.body as { costumeId: number }).costumeId;
    const codeResponse = await api.post('/visits/preview-code').expect(201);
    const visitCode = codeResponse.body as string;
    const visit = await api
      .post('/visits?sendNotification=false')
      .send({
        clientId,
        visitCode,
        startDateTime: '2026-12-20',
        endDateTime: '2026-12-21',
        issueTimeFrom: '10:00',
        issueTimeTo: '19:00',
        returnTimeUntil: '19:00',
        actorUserId: 999999,
        actorNameSnapshot: 'Поддельное имя',
        orders: [
          {
            childId,
            costumeId,
            rentPrice: 5000,
            prepaymentAmount: 1000,
          },
        ],
      })
      .expect(201);
    const visitId = (visit.body as { id: number }).id;
    const order = await t.prisma.order.findFirstOrThrow({
      where: { visitId, deletedAt: null },
    });
    return { visitId, visitCode, orderId: order.id };
  }

  it('records server actor snapshots across the visit lifecycle with stable pages', async () => {
    const { visitId, visitCode, orderId } = await createVisit();
    const actor = await t.prisma.user.findUniqueOrThrow({
      where: { login: t.user.login },
    });

    await api.post(`/visits/${orderId}/mark-tag-written`).expect(204);
    await api.post(`/visits/${orderId}/mark-tag-written`).expect(204);
    await api
      .post(`/visits/${visitId}/issue`)
      .send({
        additionalPayment: 5000,
        deposit: { type: 'cash', amount: 5000 },
      })
      .expect(204);
    await api.post(`/visits/${visitId}/unissue`).expect(204);
    await api
      .post(`/visits/${visitId}/issue`)
      .send({
        additionalPayment: 5000,
        deposit: { type: 'cash', amount: 5000 },
        actorUserId: 999999,
        actorNameSnapshot: 'Поддельное имя',
      })
      .expect(204);
    await api
      .post(`/visits/${visitId}/complete-return`)
      .send({
        depositReturned: false,
        settlement: { kind: 'customer_refund', amount: 1000 },
      })
      .expect(201);
    await api
      .post(`/visits/${visitId}/mark-deposit-returned`)
      .send({})
      .expect(201);
    await api
      .post(`/visits/${visitId}/mark-deposit-returned`)
      .send({ notes: 'повтор' })
      .expect(201);

    const snapshotRefs = await t.prisma.visit.findUniqueOrThrow({
      where: { id: visitId },
      include: {
        client: true,
        orders: { include: { child: true, costume: true } },
      },
    });
    await t.prisma.user.update({
      where: { id: actor.id },
      data: { name: 'Новое имя сотрудника' },
    });
    await t.prisma.client.update({
      where: { id: snapshotRefs.clientId },
      data: { name: 'Новое имя клиента' },
    });
    await t.prisma.child.update({
      where: { id: snapshotRefs.orders[0].childId },
      data: { name: 'Новое имя ребёнка' },
    });
    await t.prisma.costume.update({
      where: { id: snapshotRefs.orders[0].costumeId },
      data: { name: 'Новое имя костюма' },
    });

    const all = await api
      .get(`/visits/${visitId}/history?limit=100`)
      .expect(200);
    const items = (all.body as { items: Array<Record<string, unknown>> }).items;
    const actions = items.map((event) => event.action);
    expect(actions).toEqual([
      'visit.created',
      'tag.written',
      'visit.issued',
      'money.received',
      'visit.unissued',
      'visit.issued',
      'money.received',
      'visit.completed',
      'money.refunded',
      'deposit.returned',
    ]);
    expect(items.every((event) => event.actorUserId === actor.id)).toBe(true);
    expect(items.every((event) => event.actorNameSnapshot === actor.name)).toBe(
      true,
    );
    expect(items.every((event) => event.source === 'user')).toBe(true);
    expect(items[0].payload).toMatchObject({
      kind: 'visit.created',
      visitCode,
      clientName: 'Клиент истории',
    });
    expect(items[1].payload).toMatchObject({
      kind: 'tag.written',
      childName: 'Ребёнок истории',
      costumeName: 'Костюм истории',
    });
    expect(items[0].payload).toMatchObject({ clientName: 'Клиент истории' });
    expect(items[1].payload).toMatchObject({
      childName: 'Ребёнок истории',
      costumeName: 'Костюм истории',
    });
    expect(items.every((event) => event.commandId)).toBe(true);
    expect(items.every((event) => event.schemaVersion === 1)).toBe(true);
    expect(items.every((event) => typeof event.occurredAt === 'string')).toBe(
      true,
    );

    const firstPage = await api
      .get(`/visits/${visitId}/history?page=1&limit=3`)
      .expect(200);
    const secondPage = await api
      .get(`/visits/${visitId}/history?page=2&limit=3`)
      .expect(200);
    const firstItems = (firstPage.body as { items: { id: number }[] }).items;
    const secondItems = (secondPage.body as { items: { id: number }[] }).items;
    expect(firstItems.map((event) => event.id)).toEqual(
      items.slice(0, 3).map((event) => event.id),
    );
    expect(secondItems.map((event) => event.id)).toEqual(
      items.slice(3, 6).map((event) => event.id),
    );
    await api.get(`/visits/${visitId}/history?page=0`).expect(400);
    await api.get(`/visits/${visitId}/history?limit=101`).expect(400);
    await authed(t.app, 'invalid')
      .get(`/visits/${visitId}/history`)
      .expect(401);
  });

  it('returns empty history for a legacy visit and 404 for soft-deleted visits', async () => {
    const client = await t.prisma.client.create({
      data: { name: 'Старый клиент', phone: `+${nextPhone++}` },
    });
    const legacy = await t.prisma.visit.create({
      data: {
        visitCode: '9988',
        clientId: client.id,
        startDateTime: new Date('2025-12-20T10:00:00.000Z'),
        endDateTime: new Date('2025-12-21T10:00:00.000Z'),
        issueTimeFrom: '10:00',
        issueTimeTo: '19:00',
        returnTimeUntil: '19:00',
      },
    });
    const result = await api.get(`/visits/${legacy.id}/history`).expect(200);
    expect(result.body).toMatchObject({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
    });
    await t.prisma.visit.update({
      where: { id: legacy.id },
      data: { deletedAt: new Date() },
    });
    await api.get(`/visits/${legacy.id}/history`).expect(404);
  });

  it('keeps cancellation history readable', async () => {
    const { visitId } = await createVisit();
    await api
      .post(`/visits/${visitId}/cancel`)
      .send({ reason: 'проверка' })
      .expect(204);
    const response = await api.get(`/visits/${visitId}/history`).expect(200);
    const events = (response.body as { items: { action: string }[] }).items;
    expect(events.map((event) => event.action)).toEqual([
      'visit.created',
      'visit.cancelled',
    ]);
    const history = await api.get(`/visits/${visitId}/history`).expect(200);
    expect(
      (history.body as { items: { payload: unknown }[] }).items[1].payload,
    ).toMatchObject({ reason: 'проверка' });
  });

  it('records debt settlement without a returned none deposit event', async () => {
    const { visitId } = await createVisit();
    await api
      .post(`/visits/${visitId}/issue`)
      .send({ additionalPayment: 0, deposit: { type: 'none' } })
      .expect(204);
    await api
      .post(`/visits/${visitId}/complete-return`)
      .send({
        depositReturned: true,
        settlement: { kind: 'debt_payment', amount: 4000 },
      })
      .expect(201);
    const response = await api
      .get(`/visits/${visitId}/history?limit=100`)
      .expect(200);
    const events = (response.body as { items: { action: string }[] }).items;
    expect(events.map((event) => event.action)).toEqual([
      'visit.created',
      'visit.issued',
      'visit.completed',
      'money.received',
    ]);
  });

  it('rolls back a tag mutation if its audit event cannot be saved', async () => {
    const { visitId, orderId } = await createVisit();
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
                        .mockRejectedValue(
                          new Error('audit storage unavailable'),
                        );
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
      await api.post(`/visits/${orderId}/mark-tag-written`).expect(500);
    } finally {
      transactionSpy.mockRestore();
    }
    const order = await t.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    expect(order.tagStatus).toBe('not_written');
    expect(await t.prisma.auditEvent.count({ where: { visitId } })).toBe(1); // the booking event remains; the failed tag event is absent
  });
});

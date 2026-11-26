import { randomUUID } from 'node:crypto';
import { TestApp, createTestApp } from './support/test-app';
import { authed, login } from './support/http';

describe('reserved visit editing (integration)', () => {
  let t: TestApp;
  let api: ReturnType<typeof authed>;
  let nextPhone = 77079000000;

  beforeAll(async () => {
    t = await createTestApp();
    api = authed(t.app, await login(t.app, t.user));
  });

  afterAll(async () => {
    await t.close();
  });

  async function seedBooking() {
    const client = await api
      .post('/clients')
      .send({ name: 'Айгерим', phone: `+${nextPhone++}` })
      .expect(201);
    const clientId = (client.body as { clientId: number }).clientId;
    const firstChild = await api
      .post('/children')
      .send({ clientId, name: 'Аружан' })
      .expect(201);
    const secondChild = await api
      .post('/children')
      .send({ clientId, name: 'Данияр' })
      .expect(201);
    const firstCostume = await api
      .post('/costumes')
      .send({ name: 'Снегурочка' })
      .expect(201);
    const secondCostume = await api
      .post('/costumes')
      .send({ name: 'Зайчик' })
      .expect(201);
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
        notes: 'Не терять бирку',
        orders: [
          {
            childId: (firstChild.body as { childId: number }).childId,
            costumeId: (firstCostume.body as { costumeId: number }).costumeId,
            rentPrice: 5000,
            prepaymentAmount: 1000,
            notes: 'Исходная пометка',
          },
        ],
      })
      .expect(201);
    return {
      clientId,
      visitId: (created.body as { id: number }).id,
      childId: (firstChild.body as { childId: number }).childId,
      secondChildId: (secondChild.body as { childId: number }).childId,
      costumeId: (firstCostume.body as { costumeId: number }).costumeId,
      secondCostumeId: (secondCostume.body as { costumeId: number }).costumeId,
    };
  }

  it('accepts prepayment only for new orders, includes it in totals and receipt, and rejects changing saved prepayments', async () => {
    const ids = await seedBooking();
    const visit = await t.prisma.visit.findUniqueOrThrow({
      where: { id: ids.visitId },
      include: { orders: true },
    });
    const old = visit.orders[0];
    const command = {
      commandId: randomUUID(),
      expectedVersion: visit.version,
      startDateTime: '2026-12-20',
      endDateTime: '2026-12-21',
      issueTimeFrom: '10:00',
      issueTimeTo: '19:00',
      returnTimeUntil: '19:00',
      orders: [
        {
          orderId: old.id,
          childId: ids.childId,
          costumeId: ids.costumeId,
          rentPrice: 5000,
        },
        {
          childId: ids.secondChildId,
          costumeId: ids.secondCostumeId,
          rentPrice: 4000,
          prepaymentAmount: 1500,
        },
      ],
    };
    for (const invalid of [-1, 1.5, 4001]) {
      await api
        .patch(`/visits/${ids.visitId}`)
        .send({
          ...command,
          orders: [
            command.orders[0],
            { ...command.orders[1], prepaymentAmount: invalid },
          ],
        })
        .expect(400);
    }
    await api
      .patch(`/visits/${ids.visitId}`)
      .send({
        ...command,
        orders: [{ ...command.orders[0], prepaymentAmount: 1200 }],
      })
      .expect(400);
    expect(
      await t.prisma.order.count({
        where: { visitId: ids.visitId, deletedAt: null },
      }),
    ).toBe(1);
    const result = await api
      .patch(`/visits/${ids.visitId}`)
      .send(command)
      .expect(200);
    expect(result.body).toMatchObject({
      totals: { totalRent: 9000, totalPrepayment: 2500, totalRemaining: 6500 },
    });
    const added = await t.prisma.order.findFirstOrThrow({
      where: { visitId: ids.visitId, costumeId: ids.secondCostumeId },
    });
    expect(added.prepaymentAmount).toBe(1500);
    expect(
      await t.prisma.visitMoneyOperation.count({
        where: { visitId: ids.visitId },
      }),
    ).toBe(0);
    const event = await t.prisma.auditEvent.findFirstOrThrow({
      where: { commandId: command.commandId, action: 'visit.updated' },
    });
    expect(event.payload).toMatchObject({
      orderChanges: [
        {
          change: 'added',
          after: { prepaymentAmount: 1500 },
        },
      ],
    });
    await t.redis.flushdb();
    const replay = await api
      .patch(`/visits/${ids.visitId}`)
      .send(command)
      .expect(200);
    expect(replay.body).toEqual(result.body);
    expect(
      await t.prisma.order.count({
        where: { visitId: ids.visitId, deletedAt: null },
      }),
    ).toBe(2);
  });

  it('updates reserved orders atomically, preserves notes and receipt response, and invalidates written tags', async () => {
    const ids = await seedBooking();
    let visit = await t.prisma.visit.findUniqueOrThrow({
      where: { id: ids.visitId },
      include: { orders: true },
    });
    const [existing] = visit.orders;
    await api.post(`/visits/${existing.id}/mark-tag-written`).expect(204);
    visit = await t.prisma.visit.findUniqueOrThrow({
      where: { id: ids.visitId },
      include: { orders: true },
    });

    const firstCommand = {
      commandId: randomUUID(),
      expectedVersion: visit.version,
      startDateTime: '2026-12-22',
      endDateTime: '2026-12-23',
      issueTimeFrom: '10:00',
      issueTimeTo: '19:00',
      returnTimeUntil: '19:00',
      orders: [
        {
          orderId: existing.id,
          childId: ids.childId,
          costumeId: ids.costumeId,
          rentPrice: 6000,
        },
        {
          childId: ids.secondChildId,
          costumeId: ids.secondCostumeId,
          rentPrice: 4000,
        },
      ],
    };
    const first = await api
      .patch(`/visits/${ids.visitId}`)
      .send(firstCommand)
      .expect(200);
    expect(first.body).toMatchObject({
      id: ids.visitId,
      version: visit.version + 1,
      startDateTime: '2026-12-22',
      notes: 'Не терять бирку',
      totals: { totalRent: 10000, totalPrepayment: 1000 },
    });
    const firstResponse = first.body as {
      version: number;
      orders: { orderId: number; tagStatus: string; notes?: string }[];
    };
    expect(firstResponse.orders).toHaveLength(2);
    const originalResponseOrder = firstResponse.orders.find(
      (order) => order.orderId === existing.id,
    );
    const addedResponseOrder = firstResponse.orders.find(
      (order) => order.orderId !== existing.id,
    );
    expect(originalResponseOrder).toMatchObject({
      orderId: existing.id,
      tagStatus: 'not_written',
      notes: 'Исходная пометка',
    });
    const available = await api
      .get(
        `/costumes/search-available?q=%D0%A1%D0%BD%D0%B5%D0%B3%D1%83%D1%80%D0%BE%D1%87%D0%BA%D0%B0&startDate=2026-12-22T10:00&endDate=2026-12-23T19:00&excludeVisitId=${ids.visitId}`,
      )
      .expect(200);
    expect(available.body).toContainEqual(
      expect.objectContaining({
        costumeId: ids.costumeId,
        status: 'available',
      }),
    );
    if (!addedResponseOrder)
      throw new Error('Added order is missing from response');
    const addedOrderId = addedResponseOrder.orderId;

    const databaseAfterEdit = await t.prisma.visit.findUniqueOrThrow({
      where: { id: ids.visitId },
      include: { orders: true },
    });
    expect(databaseAfterEdit.version).toBe(visit.version + 1);
    expect(
      databaseAfterEdit.orders.find((order) => order.id === existing.id),
    ).toMatchObject({
      prepaymentAmount: 1000,
      notes: 'Исходная пометка',
      tagStatus: 'not_written',
    });
    expect(
      databaseAfterEdit.orders.find((order) => order.id === addedOrderId),
    ).toMatchObject({
      status: 'reserved',
      prepaymentAmount: 0,
      tagStatus: 'not_written',
    });
    expect(
      await t.prisma.auditEvent.count({ where: { visitId: ids.visitId } }),
    ).toBe(4); // created, tag.written, updated, tag.invalidated

    const nextCommand = {
      ...firstCommand,
      commandId: randomUUID(),
      expectedVersion: visit.version + 1,
      orders: firstResponse.orders.map((order) => ({
        orderId: order.orderId,
        childId:
          order.orderId === existing.id ? ids.childId : ids.secondChildId,
        costumeId:
          order.orderId === existing.id ? ids.costumeId : ids.secondCostumeId,
        rentPrice: order.orderId === existing.id ? 6500 : 4000,
      })),
    };
    await api.patch(`/visits/${ids.visitId}`).send(nextCommand).expect(200);
    await t.redis.flushdb();
    const replay = await api
      .patch(`/visits/${ids.visitId}`)
      .send(firstCommand)
      .expect(200);
    expect(replay.body).toMatchObject({ version: visit.version + 1 });
    expect(
      await t.prisma.order.findUniqueOrThrow({ where: { id: existing.id } }),
    ).toMatchObject({ rentPrice: 6500 });

    const stale = await api
      .patch(`/visits/${ids.visitId}`)
      .send({ ...firstCommand, commandId: randomUUID() })
      .expect(409);
    expect(stale.body).toMatchObject({ code: 'VISIT_VERSION_CONFLICT' });

    const noOpCommand = {
      ...nextCommand,
      commandId: randomUUID(),
      expectedVersion: visit.version + 2,
    };
    const beforeNoOpAudits = await t.prisma.auditEvent.count({
      where: { visitId: ids.visitId },
    });
    const noOp = await api
      .patch(`/visits/${ids.visitId}`)
      .send(noOpCommand)
      .expect(200);
    expect(noOp.body).toMatchObject({ version: visit.version + 2 });
    expect(
      await t.prisma.auditEvent.count({ where: { visitId: ids.visitId } }),
    ).toBe(beforeNoOpAudits);
  });

  it('rejects deleting an order with prepayment and duplicate order ids', async () => {
    const ids = await seedBooking();
    const visit = await t.prisma.visit.findUniqueOrThrow({
      where: { id: ids.visitId },
      include: { orders: true },
    });
    const common = {
      expectedVersion: visit.version,
      startDateTime: '2026-12-20',
      endDateTime: '2026-12-21',
      issueTimeFrom: '10:00',
      issueTimeTo: '19:00',
      returnTimeUntil: '19:00',
    };
    const otherIds = await seedBooking();
    const foreignVisit = await t.prisma.visit.findUniqueOrThrow({
      where: { id: otherIds.visitId },
      include: { orders: true },
    });
    await api
      .patch(`/visits/${ids.visitId}`)
      .send({
        commandId: randomUUID(),
        ...common,
        orders: [
          {
            orderId: foreignVisit.orders[0].id,
            childId: ids.childId,
            costumeId: ids.costumeId,
            rentPrice: 5000,
          },
        ],
      })
      .expect(400);
    await api
      .patch(`/visits/${ids.visitId}`)
      .send({
        commandId: randomUUID(),
        ...common,
        orders: [{ orderId: 0, childId: 0, costumeId: 0, rentPrice: 5000 }],
      })
      .expect(400);
    await api
      .patch(`/visits/${ids.visitId}`)
      .send({
        commandId: randomUUID(),
        ...common,
        orders: [
          {
            orderId: visit.orders[0].id,
            childId: ids.childId,
            costumeId: ids.costumeId,
            rentPrice: 500,
          },
        ],
      })
      .expect(400);
    await api
      .patch(`/visits/${ids.visitId}`)
      .send({
        commandId: randomUUID(),
        ...common,
        orders: [
          {
            childId: ids.secondChildId,
            costumeId: ids.secondCostumeId,
            rentPrice: 5000,
          },
        ],
      })
      .expect(400);
    await api
      .patch(`/visits/${ids.visitId}`)
      .send({
        commandId: randomUUID(),
        ...common,
        orders: [
          {
            orderId: visit.orders[0].id,
            childId: ids.childId,
            costumeId: ids.costumeId,
            rentPrice: 5000,
          },
          {
            orderId: visit.orders[0].id,
            childId: ids.childId,
            costumeId: ids.secondCostumeId,
            rentPrice: 5000,
          },
        ],
      })
      .expect(400);

    const foreignClient = await api
      .post('/clients')
      .send({ name: 'Ботагоз', phone: `+${nextPhone++}` })
      .expect(201);
    const foreignChild = await api
      .post('/children')
      .send({
        clientId: (foreignClient.body as { clientId: number }).clientId,
        name: 'Жан',
      })
      .expect(201);
    await api
      .patch(`/visits/${ids.visitId}`)
      .send({
        commandId: randomUUID(),
        ...common,
        orders: [
          {
            orderId: visit.orders[0].id,
            childId: (foreignChild.body as { childId: number }).childId,
            costumeId: ids.costumeId,
            rentPrice: 5000,
          },
        ],
      })
      .expect(400);

    await api.delete(`/costumes/${ids.secondCostumeId}`).expect(204);
    await api
      .patch(`/visits/${ids.visitId}`)
      .send({
        commandId: randomUUID(),
        ...common,
        orders: [
          {
            orderId: visit.orders[0].id,
            childId: ids.childId,
            costumeId: ids.secondCostumeId,
            rentPrice: 5000,
          },
        ],
      })
      .expect(400);
  });

  it('invalidates a written tag when only the issue window changes', async () => {
    const ids = await seedBooking();
    const visit = await t.prisma.visit.findUniqueOrThrow({
      where: { id: ids.visitId },
      include: { orders: true },
    });
    const [order] = visit.orders;
    await api.post(`/visits/${order.id}/mark-tag-written`).expect(204);
    const current = await t.prisma.visit.findUniqueOrThrow({
      where: { id: ids.visitId },
      include: { orders: true },
    });
    await api
      .patch(`/visits/${ids.visitId}`)
      .send({
        commandId: randomUUID(),
        expectedVersion: current.version,
        startDateTime: '2026-12-20',
        endDateTime: '2026-12-21',
        issueTimeFrom: '10:00',
        issueTimeTo: '20:00',
        returnTimeUntil: '19:00',
        orders: [
          {
            orderId: order.id,
            childId: ids.childId,
            costumeId: ids.costumeId,
            rentPrice: 5000,
          },
        ],
      })
      .expect(200);
    expect(
      await t.prisma.order.findUniqueOrThrow({ where: { id: order.id } }),
    ).toMatchObject({ tagStatus: 'not_written' });
    const invalidation = await t.prisma.auditEvent.findFirstOrThrow({
      where: { visitId: ids.visitId, action: 'tag.invalidated' },
    });
    expect(invalidation.payload).toMatchObject({
      kind: 'tag.invalidated',
      reason: 'window_changed',
    });
  });

  it('rejects editing a visit whose client has been soft-deleted', async () => {
    const ids = await seedBooking();
    const visit = await t.prisma.visit.findUniqueOrThrow({
      where: { id: ids.visitId },
      include: { orders: true },
    });
    await t.prisma.client.update({
      where: { id: ids.clientId },
      data: { deletedAt: new Date() },
    });
    await api
      .patch(`/visits/${ids.visitId}`)
      .send({
        commandId: randomUUID(),
        expectedVersion: visit.version,
        startDateTime: '2026-12-20',
        endDateTime: '2026-12-21',
        issueTimeFrom: '10:00',
        issueTimeTo: '19:00',
        returnTimeUntil: '19:00',
        orders: [
          {
            orderId: visit.orders[0].id,
            childId: ids.childId,
            costumeId: ids.costumeId,
            rentPrice: 5000,
          },
        ],
      })
      .expect(404);
  });

  it('serializes a concurrent edit and issue without losing either committed state', async () => {
    const ids = await seedBooking();
    const visit = await t.prisma.visit.findUniqueOrThrow({
      where: { id: ids.visitId },
      include: { orders: true },
    });
    const edit = {
      commandId: randomUUID(),
      expectedVersion: visit.version,
      startDateTime: '2026-12-20',
      endDateTime: '2026-12-21',
      issueTimeFrom: '10:00',
      issueTimeTo: '19:00',
      returnTimeUntil: '19:00',
      orders: [
        {
          orderId: visit.orders[0].id,
          childId: ids.childId,
          costumeId: ids.costumeId,
          rentPrice: 5500,
        },
      ],
    };
    let arrived = 0;
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const startTogether = async <T>(action: () => Promise<T>): Promise<T> => {
      arrived += 1;
      if (arrived === 2) release();
      await barrier;
      return action();
    };
    const [editResult, issueResult] = await Promise.all([
      startTogether(() => api.patch(`/visits/${ids.visitId}`).send(edit)),
      startTogether(() =>
        api
          .post(`/visits/${ids.visitId}/issue`)
          .send({ additionalPayment: 0, deposit: { type: 'none' } }),
      ),
    ]);
    expect([200, 409]).toContain(editResult.status);
    expect([204, 409]).toContain(issueResult.status);
    const final = await t.prisma.visit.findUniqueOrThrow({
      where: { id: ids.visitId },
      include: { orders: true },
    });
    expect(final.status).toBe('issued');
    expect(final.orders[0].status).toBe('issued');
    if (editResult.status === 200) {
      expect(final.orders[0].rentPrice).toBe(5500);
      expect(issueResult.status).toBe(204);
      expect(final.version).toBe(visit.version + 2);
    } else {
      expect(editResult.body).toMatchObject({ code: 'VISIT_VERSION_CONFLICT' });
      expect(issueResult.status).toBe(204);
      expect(final.orders[0].rentPrice).toBe(5000);
      expect(final.version).toBe(visit.version + 1);
    }
  });

  it('serializes an edit against another booking for the same costume period', async () => {
    const ids = await seedBooking();
    const visit = await t.prisma.visit.findUniqueOrThrow({
      where: { id: ids.visitId },
      include: { orders: true },
    });
    const otherClient = await api
      .post('/clients')
      .send({ name: 'Мадина', phone: `+${nextPhone++}` })
      .expect(201);
    const otherClientId = (otherClient.body as { clientId: number }).clientId;
    const otherChild = await api
      .post('/children')
      .send({ clientId: otherClientId, name: 'Амина' })
      .expect(201);
    const competingCode = await api.post('/visits/preview-code').expect(201);
    const edit = {
      commandId: randomUUID(),
      expectedVersion: visit.version,
      startDateTime: '2026-12-20',
      endDateTime: '2026-12-21',
      issueTimeFrom: '10:00',
      issueTimeTo: '19:00',
      returnTimeUntil: '19:00',
      orders: [
        {
          orderId: visit.orders[0].id,
          childId: ids.childId,
          costumeId: ids.costumeId,
          rentPrice: 5000,
        },
        {
          childId: ids.childId,
          costumeId: ids.secondCostumeId,
          rentPrice: 4000,
        },
      ],
    };
    const booking = {
      clientId: otherClientId,
      visitCode: competingCode.body as string,
      startDateTime: '2026-12-20',
      endDateTime: '2026-12-21',
      issueTimeFrom: '10:00',
      issueTimeTo: '19:00',
      returnTimeUntil: '19:00',
      orders: [
        {
          childId: (otherChild.body as { childId: number }).childId,
          costumeId: ids.secondCostumeId,
          rentPrice: 4000,
          prepaymentAmount: 0,
        },
      ],
    };
    let arrived = 0;
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const startTogether = async <T>(action: () => Promise<T>): Promise<T> => {
      arrived += 1;
      if (arrived === 2) release();
      await barrier;
      return action();
    };
    const [editResult, bookingResult] = await Promise.all([
      startTogether(() => api.patch(`/visits/${ids.visitId}`).send(edit)),
      startTogether(() =>
        api.post('/visits?sendNotification=false').send(booking),
      ),
    ]);
    expect([200, 400, 409]).toContain(editResult.status);
    expect([201, 400, 409]).toContain(bookingResult.status);
    expect(
      Number(editResult.status === 200) + Number(bookingResult.status === 201),
    ).toBe(1);
    const activeOrders = await t.prisma.order.findMany({
      where: {
        costumeId: ids.secondCostumeId,
        deletedAt: null,
        status: { in: ['reserved', 'issued'] },
        startDateTime: { lt: new Date('2026-12-21T19:00:00Z') },
        endDateTime: { gt: new Date('2026-12-20T10:00:00Z') },
      },
    });
    expect(activeOrders).toHaveLength(1);
  });

  it('rolls back visit, orders, receipt, and history if audit insertion fails', async () => {
    const ids = await seedBooking();
    const visit = await t.prisma.visit.findUniqueOrThrow({
      where: { id: ids.visitId },
      include: { orders: true },
    });
    await t.prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION reject_test_visit_update_audit() RETURNS trigger AS $$
      BEGIN
        IF NEW.action = 'visit.updated' THEN
          RAISE EXCEPTION 'forced audit failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await t.prisma.$executeRawUnsafe(`
      CREATE TRIGGER reject_test_visit_update_audit
      BEFORE INSERT ON audit_events
      FOR EACH ROW EXECUTE FUNCTION reject_test_visit_update_audit();
    `);
    const commandId = randomUUID();
    try {
      await api
        .patch(`/visits/${ids.visitId}`)
        .send({
          commandId,
          expectedVersion: visit.version,
          startDateTime: '2026-12-22',
          endDateTime: '2026-12-23',
          issueTimeFrom: '10:00',
          issueTimeTo: '19:00',
          returnTimeUntil: '19:00',
          orders: [
            {
              orderId: visit.orders[0].id,
              childId: ids.childId,
              costumeId: ids.costumeId,
              rentPrice: 6000,
            },
            {
              childId: ids.secondChildId,
              costumeId: ids.secondCostumeId,
              rentPrice: 4000,
            },
          ],
        })
        .expect(500);
    } finally {
      await t.prisma.$executeRawUnsafe(
        'DROP TRIGGER IF EXISTS reject_test_visit_update_audit ON audit_events',
      );
      await t.prisma.$executeRawUnsafe(
        'DROP FUNCTION IF EXISTS reject_test_visit_update_audit()',
      );
    }
    expect(
      await t.prisma.visit.findUniqueOrThrow({ where: { id: ids.visitId } }),
    ).toMatchObject({ version: visit.version, endDateTime: visit.endDateTime });
    expect(
      await t.prisma.order.findMany({
        where: { visitId: ids.visitId, deletedAt: null },
      }),
    ).toHaveLength(1);
    expect(
      await t.prisma.auditEvent.count({ where: { visitId: ids.visitId } }),
    ).toBe(1);
    expect(
      await t.prisma.commandReceipt.findUnique({ where: { commandId } }),
    ).toBeNull();
  });
});

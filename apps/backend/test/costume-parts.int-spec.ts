import { randomUUID } from 'node:crypto';
import { TestApp, createTestApp } from './support/test-app';
import { authed, login } from './support/http';

interface Part {
  name: string;
  qty: number;
}

const hat: Part = { name: 'Головной убор', qty: 1 };
const cape: Part = { name: 'Накидка', qty: 1 };

describe('costume parts and issued snapshot (integration)', () => {
  let t: TestApp;
  let api: ReturnType<typeof authed>;
  let nextPhone = 77079200000;

  beforeAll(async () => {
    t = await createTestApp();
    api = authed(t.app, await login(t.app, t.user));
  });

  afterAll(async () => {
    await t.close();
  });

  async function createCostume(name: string, parts?: Part[]) {
    const res = await api.post('/costumes').send({ name, parts }).expect(201);
    return (res.body as { costumeId: number }).costumeId;
  }

  async function seedClient() {
    const client = await api
      .post('/clients')
      .send({ name: 'Клиент состава', phone: `+${nextPhone++}` })
      .expect(201);
    const clientId = (client.body as { clientId: number }).clientId;
    const child = await api
      .post('/children')
      .send({ clientId, name: 'Алия' })
      .expect(201);
    return { clientId, childId: (child.body as { childId: number }).childId };
  }

  async function reserveVisit(
    ids: { clientId: number; childId: number },
    costumeIds: number[],
    date = '2026-12-20',
  ) {
    const code = await api.post('/visits/preview-code').expect(201);
    const created = await api
      .post('/visits?sendNotification=false')
      .send({
        clientId: ids.clientId,
        visitCode: code.body as string,
        startDateTime: date,
        endDateTime: `2026-12-${String(Number(date.slice(-2)) + 1)}`,
        issueTimeFrom: '10:00',
        issueTimeTo: '19:00',
        returnTimeUntil: '19:00',
        orders: costumeIds.map((costumeId) => ({
          childId: ids.childId,
          costumeId,
          rentPrice: 5000,
          prepaymentAmount: 1000,
        })),
      })
      .expect(201);
    return (created.body as { id: number }).id;
  }

  const issueBody = {
    additionalPayment: 0,
    deposit: { type: 'document' },
  };

  it('stores, validates and returns costume parts', async () => {
    const costumeId = await createCostume('Эльза состав', [
      { name: ' Головной убор ', qty: 1 },
      cape,
    ]);
    const stored = await t.prisma.costume.findUniqueOrThrow({
      where: { id: costumeId },
    });
    expect(stored.parts).toEqual([hat, cape]);

    const list = await api
      .get('/costumes/search')
      .query({ q: 'Эльза состав' })
      .expect(200);
    expect(list.body).toMatchObject([{ costumeId, parts: [hat, cape] }]);

    // Быстрый путь «название → Enter» остаётся без состава
    const plainId = await createCostume('Без состава');
    expect(
      (await t.prisma.costume.findUniqueOrThrow({ where: { id: plainId } }))
        .parts,
    ).toEqual([]);

    await api
      .post('/costumes')
      .send({ name: 'Дубли', parts: [hat, { name: 'головной убор', qty: 2 }] })
      .expect(400);
    await api
      .post('/costumes')
      .send({ name: 'Много', parts: [{ name: 'Пояс', qty: 21 }] })
      .expect(400);
    await api
      .post('/costumes')
      .send({ name: 'Пусто', parts: [{ name: '   ', qty: 1 }] })
      .expect(400);

    const updated = await api
      .patch(`/costumes/${costumeId}`)
      .send({ parts: [cape] })
      .expect(200);
    expect(updated.body).toMatchObject({ parts: [cape] });
    // PATCH без parts состав не трогает
    await api
      .patch(`/costumes/${costumeId}`)
      .send({ name: 'Эльза 2' })
      .expect(200);
    expect(
      (await t.prisma.costume.findUniqueOrThrow({ where: { id: costumeId } }))
        .parts,
    ).toEqual([cape]);
  });

  it('snapshots parts on issue, keeps it on unissue and compares the return with the snapshot', async () => {
    const ids = await seedClient();
    const costumeId = await createCostume('Снимок выдачи', [hat, cape]);
    const visitId = await reserveVisit(ids, [costumeId]);

    const forIssue = await api.get(`/visits/${visitId}/for-issue`).expect(200);
    expect(forIssue.body).toMatchObject({
      orders: [{ parts: [hat, cape] }],
    });
    const reserved = await api.get(`/visits/${visitId}`).expect(200);
    expect(reserved.body).toMatchObject({ orders: [{ parts: [hat, cape] }] });
    const order = await t.prisma.order.findFirstOrThrow({ where: { visitId } });
    expect(order.issuedParts).toBeNull();

    await api.post(`/visits/${visitId}/issue`).send(issueBody).expect(204);
    expect(
      (await t.prisma.order.findUniqueOrThrow({ where: { id: order.id } }))
        .issuedParts,
    ).toEqual([hat, cape]);

    // Состав костюма изменили после выдачи — возврат сверяется со снимком
    await api
      .patch(`/costumes/${costumeId}`)
      .send({ parts: [hat, { name: 'Пояс', qty: 1 }] })
      .expect(200);
    const forReturn = await api
      .get(`/visits/${visitId}/for-return`)
      .expect(200);
    expect(forReturn.body).toMatchObject({ orders: [{ parts: [hat, cape] }] });
    const issued = await api.get(`/visits/${visitId}`).expect(200);
    expect(issued.body).toMatchObject({ orders: [{ parts: [hat, cape] }] });

    // Отмена выдачи снимок не стирает, повторная выдача перезапишет актуальным составом
    await api.post(`/visits/${visitId}/unissue`).expect(204);
    expect(
      (await t.prisma.order.findUniqueOrThrow({ where: { id: order.id } }))
        .issuedParts,
    ).toEqual([hat, cape]);
    await api.post(`/visits/${visitId}/issue`).send(issueBody).expect(204);
    expect(
      (await t.prisma.order.findUniqueOrThrow({ where: { id: order.id } }))
        .issuedParts,
    ).toEqual([hat, { name: 'Пояс', qty: 1 }]);
  });

  it('records missing parts in the visit history on return and rejects invalid ones', async () => {
    const ids = await seedClient();
    const costumeId = await createCostume('Возврат без части', [hat, cape]);
    const otherVisitCostume = await createCostume('Чужой заказ', [hat]);
    const visitId = await reserveVisit(ids, [costumeId], '2026-12-22');
    const otherVisitId = await reserveVisit(
      ids,
      [otherVisitCostume],
      '2026-12-24',
    );
    await api.post(`/visits/${visitId}/issue`).send(issueBody).expect(204);
    const order = await t.prisma.order.findFirstOrThrow({ where: { visitId } });
    const foreignOrder = await t.prisma.order.findFirstOrThrow({
      where: { visitId: otherVisitId },
    });

    await api
      .post(`/visits/${visitId}/complete-return`)
      .send({
        depositReturned: false,
        missingParts: [{ orderId: foreignOrder.id, parts: ['Головной убор'] }],
      })
      .expect(400);
    await api
      .post(`/visits/${visitId}/complete-return`)
      .send({
        depositReturned: false,
        missingParts: [{ orderId: order.id, parts: ['Крылья'] }],
      })
      .expect(400);
    expect(
      (await t.prisma.visit.findUniqueOrThrow({ where: { id: visitId } }))
        .status,
    ).toBe('issued');

    await api
      .post(`/visits/${visitId}/complete-return`)
      .send({
        depositReturned: false,
        missingParts: [{ orderId: order.id, parts: ['накидка'] }],
      })
      .expect(201);
    const visit = await t.prisma.visit.findUniqueOrThrow({
      where: { id: visitId },
    });
    expect(visit.status).toBe('completed');
    // Денег возврат с недостающей частью не затрагивает
    expect(
      await t.prisma.visitMoneyOperation.count({ where: { visitId } }),
    ).toBe(0);

    const history = await api.get(`/visits/${visitId}/history`).expect(200);
    const events = (
      history.body as {
        items: { action: string; orderId?: number; payload: object }[];
      }
    ).items.filter((item) => item.action === 'return.missing_parts');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      orderId: order.id,
      payload: {
        kind: 'return.missing_parts',
        costumeName: 'Возврат без части',
        parts: ['Накидка'],
      },
    });
  });

  it('snapshots parts on quick issue and add-and-issue', async () => {
    const ids = await seedClient();
    const quickCostume = await createCostume('Быстрый с составом', [cape]);
    const code = await api.post('/visits/preview-code').expect(201);
    const quick = await api
      .post('/visits/quick-issue')
      .send({
        commandId: randomUUID(),
        clientId: ids.clientId,
        visitCode: code.body as string,
        startDateTime: '2026-12-26',
        issueTimeFrom: '10:07',
        issueTimeTo: '10:07',
        endDateTime: '2026-12-27',
        returnTimeUntil: '19:00',
        orders: [
          { childId: ids.childId, costumeId: quickCostume, rentPrice: 5000 },
        ],
        additionalPayment: 0,
        deposit: { type: 'none' },
      })
      .expect(201);
    const visitId = (quick.body as { visitId: number }).visitId;
    expect(
      (await t.prisma.order.findFirstOrThrow({ where: { visitId } }))
        .issuedParts,
    ).toEqual([cape]);

    const addedCostume = await createCostume('Добавленный с составом', [
      hat,
      { name: 'Пояс', qty: 2 },
    ]);
    const version = (
      await t.prisma.visit.findUniqueOrThrow({ where: { id: visitId } })
    ).version;
    const added = await api
      .post(`/visits/${visitId}/add-and-issue`)
      .send({
        commandId: randomUUID(),
        expectedVersion: version,
        orders: [
          { childId: ids.childId, costumeId: addedCostume, rentPrice: 3000 },
        ],
        additionalPayment: 0,
      })
      .expect(200);
    expect(
      (
        added.body as {
          orders: { costumeId: number; parts: Part[] }[];
        }
      ).orders.find((order) => order.costumeId === addedCostume)?.parts,
    ).toEqual([hat, { name: 'Пояс', qty: 2 }]);
    expect(
      (
        await t.prisma.order.findFirstOrThrow({
          where: { visitId, costumeId: addedCostume },
        })
      ).issuedParts,
    ).toEqual([hat, { name: 'Пояс', qty: 2 }]);
  });

  it('falls back to the current costume parts for an order issued before the snapshot existed', async () => {
    const ids = await seedClient();
    const costumeId = await createCostume('Старая выдача', [hat]);
    const visitId = await reserveVisit(ids, [costumeId], '2026-12-28');
    await api.post(`/visits/${visitId}/issue`).send(issueBody).expect(204);
    await t.prisma
      .$executeRaw`UPDATE orders SET issued_parts = NULL WHERE visit_id = ${visitId}`;

    const forReturn = await api
      .get(`/visits/${visitId}/for-return`)
      .expect(200);
    expect(forReturn.body).toMatchObject({ orders: [{ parts: [hat] }] });
  });
});

import request from 'supertest';
import { TestApp, createTestApp } from './support/test-app';
import { authed, httpServer, login } from './support/http';

// Сквозной сценарий основного флоу (domain.md §4): логин → клиент → ребёнок → костюм →
// резерв кода → визит → бирка → выдача → возврат. Статусы проверяются прямо в БД.
describe('visit flow (integration)', () => {
  let t: TestApp;
  let api: ReturnType<typeof authed>;

  beforeAll(async () => {
    t = await createTestApp();
    api = authed(t.app, await login(t.app, t.user));
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(() => {
    t.notificationQueue.add.mockClear();
  });

  interface Ids {
    clientId: number;
    childId: number;
    costumeId: number;
  }

  /** Создаёт клиента, ребёнка и костюм через API. */
  async function seedBooking(phone: string): Promise<Ids> {
    const client = await api
      .post('/clients')
      .send({ name: 'Алия', phone })
      .expect(201);
    const clientId = (client.body as { clientId: number }).clientId;

    const child = await api
      .post('/children')
      .send({ clientId, name: 'Маша' })
      .expect(201);
    const childId = (child.body as { childId: number }).childId;

    const costume = await api
      .post('/costumes')
      .send({ name: 'Эльза' })
      .expect(201);
    const costumeId = (costume.body as { costumeId: number }).costumeId;

    return { clientId, childId, costumeId };
  }

  async function reserveVisitCode(): Promise<string> {
    const res = await api.post('/visits/preview-code').expect(201);
    expect(res.headers['content-type']).toMatch(/^application\/json/);
    expect(res.body).toMatch(/^\d{4}$/);
    return res.body as string;
  }

  const visitBody = (ids: Ids, visitCode: string) => ({
    clientId: ids.clientId,
    visitCode,
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
        prepaymentAmount: 1000,
      },
    ],
  });

  const notWrittenCodes = async () => {
    const res = await api.get('/visits/not_written').expect(200);
    return (res.body as { items: { visitCode: string }[] }).items.map(
      (i) => i.visitCode,
    );
  };

  it('rejects requests without a valid token', async () => {
    await authed(t.app, 'invalid').get('/visits/not_written').expect(401);
  });

  it('rejects a wrong password', async () => {
    await request(httpServer(t.app))
      .post('/auth/login')
      .send({ login: t.user.login, password: 'wrong-password-123' })
      .expect(401);
  });

  it('booking → tag written → issue → return', async () => {
    const ids = await seedBooking('+77071110001');
    const visitCode = await reserveVisitCode();
    expect(visitCode).toMatch(/^\d{4}$/);

    // --- создание визита (sendNotification=false) ---
    await api
      .post('/visits?sendNotification=false')
      .send(visitBody(ids, visitCode))
      .expect(201);

    const visit = await t.prisma.visit.findUniqueOrThrow({
      where: { visitCode },
      include: { orders: true, notifications: true, deposit: true },
    });
    expect(visit.status).toBe('reserved');
    expect(visit.notifications).toHaveLength(0);
    expect(t.notificationQueue.add).not.toHaveBeenCalled();
    expect(visit.deposit).toBeNull();
    // местное время хранится как UTC «как есть»
    expect(visit.startDateTime.toISOString()).toBe('2026-12-20T10:00:00.000Z');
    expect(visit.endDateTime.toISOString()).toBe('2026-12-21T19:00:00.000Z');
    expect(visit.orders).toHaveLength(1);
    const [order] = visit.orders;
    expect(order).toMatchObject({
      status: 'reserved',
      tagStatus: 'not_written',
      rentPrice: 5000,
      prepaymentAmount: 1000,
      finalPayment: null,
    });
    // код резерва снят после создания
    expect(await t.redis.get(`visit_code_lock:${visitCode}`)).toBeNull();

    // --- бирка ---
    expect(await notWrittenCodes()).toContain(visitCode);
    await api.post(`/visits/${order.id}/mark-tag-written`).expect(204);
    expect(
      (await t.prisma.order.findUniqueOrThrow({ where: { id: order.id } }))
        .tagStatus,
    ).toBe('written');
    expect(await notWrittenCodes()).not.toContain(visitCode);

    // --- выдача: доплата = остаток, залог наличными ---
    await api
      .post(`/visits/${visit.id}/issue`)
      .send({
        additionalPayment: 4000,
        deposit: { type: 'cash', amount: 5000 },
      })
      .expect(204);

    const issued = await t.prisma.visit.findUniqueOrThrow({
      where: { id: visit.id },
      include: { orders: true, deposit: true },
    });
    expect(issued.status).toBe('issued');
    expect(issued.orders[0]).toMatchObject({
      status: 'issued',
      finalPayment: 4000,
    });
    expect(issued.deposit).toMatchObject({
      type: 'cash',
      amount: 5000,
      returned: false,
    });

    // повторная выдача запрещена
    await api
      .post(`/visits/${visit.id}/issue`)
      .send({ additionalPayment: 0, deposit: { type: 'none' } })
      .expect(400);

    // --- возврат закрывает визит целиком ---
    await api
      .post(`/visits/${visit.id}/complete-return`)
      .send({ depositReturned: true, notes: 'всё цело' })
      .expect(201);

    const done = await t.prisma.visit.findUniqueOrThrow({
      where: { id: visit.id },
      include: { orders: true, deposit: true },
    });
    expect(done.status).toBe('completed');
    expect(done.orders[0].status).toBe('returned');
    expect(done.deposit?.returned).toBe(true);
    expect(done.notes).toContain('[Завершение]: всё цело');
  });

  it('creates a pending notification and enqueues a job when sendNotification=true', async () => {
    const ids = await seedBooking('+77071110002');
    const visitCode = await reserveVisitCode();

    await api
      .post('/visits?sendNotification=true')
      .send(visitBody(ids, visitCode))
      .expect(201);

    const visit = await t.prisma.visit.findUniqueOrThrow({
      where: { visitCode },
      include: { notifications: true },
    });
    expect(visit.notifications).toHaveLength(1);
    expect(visit.notifications[0]).toMatchObject({
      type: 'booking_confirmation',
      status: 'pending',
    });
    expect(t.notificationQueue.add).toHaveBeenCalledWith(
      'send-whatsapp',
      expect.objectContaining({ notificationId: visit.notifications[0].id }),
      { jobId: `notification-${visit.notifications[0].id}` },
    );
    // реальная отправка в тестах невозможна: провайдер — мок
    expect(t.whatsapp.sendMessage).not.toHaveBeenCalled();
  });

  it('rejects a visit with a code that was not reserved', async () => {
    const ids = await seedBooking('+77071110003');

    await api
      .post('/visits?sendNotification=false')
      .send(visitBody(ids, '0000'))
      .expect(409);
  });

  it('rejects overlapping reservations of one costume', async () => {
    const ids = await seedBooking('+77071110004');
    await api
      .post('/visits?sendNotification=false')
      .send(visitBody(ids, await reserveVisitCode()))
      .expect(201);

    const res = await api
      .post('/visits?sendNotification=false')
      .send(visitBody(ids, await reserveVisitCode()));

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(
      await t.prisma.order.count({ where: { costumeId: ids.costumeId } }),
    ).toBe(1);
  });
});

import { TestApp, createTestApp } from './support/test-app';
import { authed, login } from './support/http';

describe('visit order rules (integration)', () => {
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
    const book = async (prepaymentAmount = 1000) => {
      const code = (await api.post('/visits/preview-code').expect(201))
        .body as string;
      await api
        .post('/visits?sendNotification=false')
        .send({
          clientId,
          visitCode: code,
          startDateTime: '2026-12-20',
          endDateTime: '2026-12-21',
          issueTimeFrom: '18:30',
          issueTimeTo: '19:30',
          returnTimeUntil: '18:00',
          orders: [{ childId, costumeId, rentPrice: 5000, prepaymentAmount }],
        })
        .expect(201);
      return t.prisma.visit.findUniqueOrThrow({
        where: { visitCode: code },
        include: { orders: true },
      });
    };
    return { clientId, costumeId, book };
  }

  it('cancellation releases the costume for a new booking', async () => {
    const f = await fixture('+77071110041');
    const first = await f.book();
    await api
      .post(`/visits/${first.id}/cancel`)
      .send({ reason: 'ошибка' })
      .expect(204);
    expect(
      (await t.prisma.visit.findUniqueOrThrow({ where: { id: first.id } }))
        .status,
    ).toBe('cancelled');
    expect(
      (
        await t.prisma.order.findUniqueOrThrow({
          where: { id: first.orders[0].id },
        })
      ).status,
    ).toBe('cancelled');
    const second = await f.book();
    expect(second.status).toBe('reserved');
  });

  it('unissue clears payment and permits issuing the visit again', async () => {
    const f = await fixture('+77071110042');
    const visit = await f.book();
    await api
      .post(`/visits/${visit.id}/issue`)
      .send({ additionalPayment: 4000, deposit: { type: 'document' } })
      .expect(204);
    await api.post(`/visits/${visit.id}/unissue`).expect(204);
    const reset = await t.prisma.visit.findUniqueOrThrow({
      where: { id: visit.id },
      include: { orders: true, deposits: true },
    });
    expect(reset.status).toBe('reserved');
    expect(reset.orders[0]).toMatchObject({
      status: 'reserved',
      finalPayment: null,
    });
    expect(reset.deposits).toHaveLength(1);
    expect(reset.deposits[0].deletedAt).not.toBeNull();
    expect(reset.deposits[0].type).toBe('document');
    await api
      .post(`/visits/${visit.id}/issue`)
      .send({ additionalPayment: 4000, deposit: { type: 'none' } })
      .expect(204);
    const deposits = await t.prisma.deposit.findMany({
      where: { visitId: visit.id },
      orderBy: { id: 'asc' },
    });
    expect(deposits).toHaveLength(2);
    expect(deposits[0]).toMatchObject({ type: 'document' });
    expect(deposits[0].deletedAt).not.toBeNull();
    expect(deposits[1]).toMatchObject({ type: 'none', deletedAt: null });
    const forReturn = await api
      .get(`/visits/${visit.id}/for-return`)
      .expect(200);
    expect((forReturn.body as { deposit: { type: string } }).deposit.type).toBe(
      'none',
    );
    await api
      .post(`/visits/${visit.id}/complete-return`)
      .send({ depositReturned: false })
      .expect(201);
    const unreturned = await api.get('/visits/unreturned-deposits').expect(200);
    expect(
      (unreturned.body as { items: { visitId: number }[] }).items.some(
        (item) => item.visitId === visit.id,
      ),
    ).toBe(false);
    expect(
      (await t.prisma.visit.findUniqueOrThrow({ where: { id: visit.id } }))
        .status,
    ).toBe('completed');
  });

  it('appends issue notes to existing visit notes', async () => {
    const f = await fixture('+77071110045');
    const visit = await f.book();
    await t.prisma.visit.update({
      where: { id: visit.id },
      data: { notes: 'Комментарий при бронировании' },
    });

    await api
      .post(`/visits/${visit.id}/issue`)
      .send({
        additionalPayment: 4000,
        deposit: { type: 'none' },
        notes: 'Комментарий при выдаче',
      })
      .expect(204);

    expect(
      (await t.prisma.visit.findUniqueOrThrow({ where: { id: visit.id } }))
        .notes,
    ).toBe('Комментарий при бронировании\nКомментарий при выдаче');
  });

  it('a cash deposit may be marked returned after completing the visit', async () => {
    const f = await fixture('+77071110043');
    const visit = await f.book(5000);
    await api
      .post(`/visits/${visit.id}/issue`)
      .send({ additionalPayment: 0, deposit: { type: 'cash', amount: 5000 } })
      .expect(204);
    await api
      .post(`/visits/${visit.id}/complete-return`)
      .send({ depositReturned: false })
      .expect(201);
    expect(
      (
        await t.prisma.deposit.findFirstOrThrow({
          where: { visitId: visit.id, deletedAt: null },
        })
      ).returned,
    ).toBe(false);
    await api
      .post(`/visits/${visit.id}/mark-deposit-returned`)
      .send({ notes: 'отдали' })
      .expect(201);
    expect(
      (
        await t.prisma.deposit.findFirstOrThrow({
          where: { visitId: visit.id, deletedAt: null },
        })
      ).returned,
    ).toBe(true);
    expect(
      (await t.prisma.visit.findUniqueOrThrow({ where: { id: visit.id } }))
        .notes,
    ).toContain('[Возврат залога]: отдали');
  });

  it('finds reserved and issued visits by code, child, costume, inventory code and phone', async () => {
    const f = await fixture('+77071110044');
    const visit = await f.book();
    const costume = await t.prisma.costume.findUniqueOrThrow({
      where: { id: f.costumeId },
    });
    for (const query of [
      visit.visitCode,
      'Маша',
      'Эльза',
      costume.inventoryCode,
      '7707',
    ]) {
      const result = await api
        .get(`/visits/search?q=${encodeURIComponent(query)}`)
        .expect(200);
      expect(JSON.stringify(result.body)).toContain(visit.visitCode);
    }
    await api
      .post(`/visits/${visit.id}/issue`)
      .send({ additionalPayment: 4000, deposit: { type: 'none' } })
      .expect(204);
    for (const query of [
      visit.visitCode,
      'Маша',
      'Эльза',
      costume.inventoryCode,
      '7707',
    ]) {
      const result = await api
        .get(`/visits/return-search?q=${encodeURIComponent(query)}`)
        .expect(200);
      expect(JSON.stringify(result.body)).toContain(visit.visitCode);
    }
  });
});

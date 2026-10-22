import type {
  PaginatedVisitsResponseDto as VisitListResponse,
  VisitReadDetailDto as VisitDetailResponse,
} from '@costumes/shared';
import { TestApp, createTestApp } from './support/test-app';
import { authed, login } from './support/http';

type TestVisitStatus = 'reserved' | 'issued' | 'completed' | 'cancelled';

interface VisitFixture {
  id: number;
  visitCode: string;
  clientId: number;
  childId: number;
  costumeId: number;
  orderId: number;
  inventoryCode: string;
}

describe('visit read API (integration)', () => {
  let t: TestApp;
  let api: ReturnType<typeof authed>;
  let nextCode = 9100;
  let nextPhone = 77079981000;

  beforeAll(async () => {
    t = await createTestApp();
    api = authed(t.app, await login(t.app, t.user));
  });

  afterAll(async () => {
    await t.close();
  });

  async function createVisit(input: {
    label: string;
    status?: TestVisitStatus;
    date?: string;
    createdAt?: Date;
    rentPrice?: number;
    prepaymentAmount?: number;
    orderStatus?: 'reserved' | 'issued' | 'returned' | 'cancelled';
  }): Promise<VisitFixture> {
    const client = await t.prisma.client.create({
      data: { name: `${input.label} client`, phone: `+${nextPhone++}` },
    });
    const child = await t.prisma.child.create({
      data: { clientId: client.id, name: `${input.label} child` },
    });
    const costume = await t.prisma.costume.create({
      data: { name: `${input.label} costume` },
    });
    const date = input.date ?? '2026-12-20';
    const createdAt = input.createdAt ?? new Date('2026-10-22T10:00:00.000Z');
    const visitCode = String(nextCode++);
    const visit = await t.prisma.visit.create({
      data: {
        visitCode,
        clientId: client.id,
        status: input.status ?? 'reserved',
        startDateTime: new Date(`${date}T00:00:00.000Z`),
        endDateTime: new Date(`${date}T00:00:00.000Z`),
        issueTimeFrom: '10:00',
        issueTimeTo: '19:00',
        returnTimeUntil: '19:00',
        createdAt,
      },
    });
    const order = await t.prisma.order.create({
      data: {
        visitId: visit.id,
        clientId: client.id,
        childId: child.id,
        costumeId: costume.id,
        startDateTime: visit.startDateTime,
        endDateTime: visit.endDateTime,
        rentPrice: input.rentPrice ?? 5000,
        prepaymentAmount: input.prepaymentAmount ?? 1000,
        status: input.orderStatus ?? 'reserved',
      },
    });
    return {
      id: visit.id,
      visitCode,
      clientId: client.id,
      childId: child.id,
      costumeId: costume.id,
      orderId: order.id,
      inventoryCode: costume.inventoryCode,
    };
  }

  it('searches every supported field, filters dates inclusively, and paginates stably', async () => {
    const target = await createVisit({
      label: 'ReadSearchTarget',
      date: '2026-12-20',
      createdAt: new Date('2026-10-22T10:00:00.000Z'),
    });
    await createVisit({ label: 'ReadSearchOutside', date: '2026-12-21' });

    const byClient = await api
      .get('/visits')
      .query({ q: 'ReadSearchTarget' })
      .expect(200);
    const rows = (byClient.body as VisitListResponse).items;
    expect(rows.map((row) => row.id)).toEqual([target.id]);
    expect(rows[0]).toMatchObject({
      childrenNames: 'ReadSearchTarget child',
      costumesNames: 'ReadSearchTarget costume',
      orderCount: 1,
      totalRent: 5000,
      totalPrepayment: 1000,
      totalRemaining: 4000,
    });

    const byVisitCode = await api
      .get('/visits')
      .query({ q: target.visitCode })
      .expect(200);
    expect(
      (byVisitCode.body as VisitListResponse).items.map((row) => row.id),
    ).toEqual([target.id]);

    const byPhone = await api
      .get('/visits')
      .query({ q: String(nextPhone - 2).slice(-7) })
      .expect(200);
    expect(
      (byPhone.body as VisitListResponse).items.map((row) => row.id),
    ).toContain(target.id);

    const byChild = await api
      .get('/visits')
      .query({ q: 'ReadSearchTarget child' })
      .expect(200);
    expect(
      (byChild.body as VisitListResponse).items.map((row) => row.id),
    ).toContain(target.id);

    const byCostume = await api
      .get('/visits')
      .query({ q: 'ReadSearchTarget costume' })
      .expect(200);
    expect(
      (byCostume.body as VisitListResponse).items.map((row) => row.id),
    ).toContain(target.id);

    const byInventory = await api
      .get('/visits')
      .query({ q: target.inventoryCode })
      .expect(200);
    expect(
      (byInventory.body as VisitListResponse).items.map((row) => row.id),
    ).toContain(target.id);

    const byDate = await api
      .get('/visits')
      .query({
        q: 'ReadSearchTarget',
        startDateFrom: '2026-12-20',
        startDateTo: '2026-12-20',
        endDateFrom: '2026-12-20',
        endDateTo: '2026-12-20',
      })
      .expect(200);
    expect((byDate.body as VisitListResponse).total).toBe(1);

    const pages = await Promise.all([
      createVisit({
        label: 'ReadPageTarget one',
        createdAt: new Date('2026-10-22T10:00:00.000Z'),
      }),
      createVisit({
        label: 'ReadPageTarget two',
        createdAt: new Date('2026-10-22T12:00:00.000Z'),
      }),
      createVisit({
        label: 'ReadPageTarget three',
        createdAt: new Date('2026-10-22T12:00:00.000Z'),
      }),
    ]);
    const firstPage = await api
      .get('/visits')
      .query({ q: 'ReadPageTarget', page: 1, limit: 2 })
      .expect(200);
    const secondPage = await api
      .get('/visits')
      .query({ q: 'ReadPageTarget', page: 2, limit: 2 })
      .expect(200);
    const first = firstPage.body as VisitListResponse;
    const second = secondPage.body as VisitListResponse;
    expect(first).toMatchObject({ total: 3, page: 1, limit: 2, hasMore: true });
    expect(second).toMatchObject({
      total: 3,
      page: 2,
      limit: 2,
      hasMore: false,
    });
    expect(first.items.map((row) => row.id)).toEqual([
      pages[2].id,
      pages[1].id,
    ]);
    expect(second.items.map((row) => row.id)).toEqual([pages[0].id]);
  });

  it('lists every status and hides soft-deleted visits and orders', async () => {
    const statuses: TestVisitStatus[] = [
      'reserved',
      'issued',
      'completed',
      'cancelled',
    ];
    const fixtures = await Promise.all(
      statuses.map((status) =>
        createVisit({
          label: `ReadStatusTarget ${status}`,
          status,
          orderStatus:
            status === 'issued'
              ? 'issued'
              : status === 'completed'
                ? 'returned'
                : status === 'cancelled'
                  ? 'cancelled'
                  : 'reserved',
        }),
      ),
    );
    for (const [index, status] of statuses.entries()) {
      const fixture = fixtures[index];
      if (!fixture) throw new Error('Статусный визит не создан');
      const response = await api
        .get('/visits')
        .query({ q: 'ReadStatusTarget', status })
        .expect(200);
      expect((response.body as VisitListResponse).items[0]?.id).toBe(
        fixture.id,
      );
    }

    const hidden = await createVisit({ label: 'ReadSoftDeletedTarget' });
    await t.prisma.visit.update({
      where: { id: hidden.id },
      data: { deletedAt: new Date() },
    });
    await t.prisma.order.update({
      where: { id: fixtures[0].orderId },
      data: { deletedAt: new Date() },
    });
    const deletedVisitList = await api
      .get('/visits')
      .query({ q: 'ReadSoftDeletedTarget' })
      .expect(200);
    expect((deletedVisitList.body as VisitListResponse).total).toBe(0);
    const activeWithoutOrders = await api
      .get(`/visits/${fixtures[0].id}`)
      .expect(200);
    expect((activeWithoutOrders.body as VisitDetailResponse).orders).toEqual(
      [],
    );
    await api.get(`/visits/${hidden.id}`).expect(404);
  });

  it('returns detail balances only after issue and identifies imported money rows', async () => {
    const reserved = await createVisit({ label: 'ReadDetailReserved' });
    const issued = await createVisit({
      label: 'ReadDetailIssued',
      status: 'issued',
      orderStatus: 'issued',
    });
    const completed = await createVisit({
      label: 'ReadDetailCompleted',
      status: 'completed',
      orderStatus: 'returned',
    });
    await t.prisma.visitMoneyOperation.create({
      data: {
        visitId: issued.id,
        kind: 'issue_payment',
        amount: 1000,
        legacyImported: true,
        createdAt: new Date('2026-10-20T10:00:00.000Z'),
      },
    });
    await t.prisma.visitMoneyOperation.create({
      data: {
        visitId: completed.id,
        kind: 'issue_payment',
        amount: 5000,
      },
    });
    const deletedDeposit = await t.prisma.deposit.create({
      data: { visitId: issued.id, type: 'document', amount: 4000 },
    });
    await t.prisma.deposit.update({
      where: { id: deletedDeposit.id },
      data: { deletedAt: new Date() },
    });
    await t.prisma.deposit.create({
      data: { visitId: issued.id, type: 'cash', amount: 5000 },
    });

    const reservedDetail = await api.get(`/visits/${reserved.id}`).expect(200);
    expect(reservedDetail.body).not.toHaveProperty('balance');
    expect((reservedDetail.body as VisitDetailResponse).version).toBe(1);

    const issuedDetail = await api.get(`/visits/${issued.id}`).expect(200);
    const issuedBody = issuedDetail.body as VisitDetailResponse;
    expect(issuedBody.balance).toMatchObject({ debt: 3000, refundDue: 0 });
    expect(issuedBody.moneyOperations).toEqual([
      expect.objectContaining({ legacyImported: true }),
    ]);
    expect(issuedBody.deposits).toHaveLength(1);
    expect(issuedBody.deposits[0]).toMatchObject({
      type: 'cash',
      returned: false,
    });
    expect(issuedBody.orders[0]).toMatchObject({
      orderId: issued.orderId,
      childId: issued.childId,
      costumeId: issued.costumeId,
    });

    const completedDetail = await api
      .get(`/visits/${completed.id}`)
      .expect(200);
    expect((completedDetail.body as VisitDetailResponse).balance).toMatchObject(
      {
        signedBalance: -1000,
        refundDue: 1000,
      },
    );
  });

  it('requires authentication and keeps existing static visit routes ahead of detail', async () => {
    await authed(t.app, 'invalid').get('/visits').expect(401);
    await authed(t.app, 'invalid').get('/visits/9100').expect(401);
    await api.get('/visits?page=not-a-number').expect(400);
    await api.get('/visits?q=Read&q=Other').expect(400);

    const search = await api
      .get('/visits/search')
      .query({ q: 'StaticRouteCheck' })
      .expect(200);
    expect(Array.isArray(search.body)).toBe(true);
    const reserved = await api.get('/visits/reserved').expect(200);
    expect(Array.isArray((reserved.body as { items: unknown[] }).items)).toBe(
      true,
    );
  });
});

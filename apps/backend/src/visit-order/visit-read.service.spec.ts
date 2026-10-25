import { NotFoundException } from '@nestjs/common';
import { VisitReadService } from './visit-read.service';
import { createPrismaMock, noPhotos } from '../test-utils';

const { prisma, reset } = createPrismaMock();
const service = new VisitReadService(prisma as never, noPhotos as never);

describe('VisitReadService', () => {
  beforeEach(() => reset());

  it('filters active visits inclusively and uses stable pagination order', async () => {
    prisma.visit.findMany.mockResolvedValue([]);
    prisma.visit.count.mockResolvedValue(0);

    const result = await service.list({
      status: 'reserved',
      startDateFrom: '2026-10-01',
      startDateTo: '2026-10-31',
      endDateFrom: '2026-11-01',
      endDateTo: '2026-11-30',
      page: 2,
      limit: 10,
    });

    expect(prisma.visit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
          status: 'reserved',
          startDateTime: {
            gte: new Date('2026-10-01T00:00:00.000Z'),
            lte: new Date('2026-10-31T23:59:59.999Z'),
          },
          endDateTime: {
            gte: new Date('2026-11-01T00:00:00.000Z'),
            lte: new Date('2026-11-30T23:59:59.999Z'),
          },
        },
        skip: 10,
        take: 10,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
    expect(result).toEqual({
      items: [],
      total: 0,
      page: 2,
      limit: 10,
      hasMore: false,
    });
  });

  it('maps visit rows with names and rent totals for the list', async () => {
    prisma.visit.findMany.mockResolvedValue([
      {
        id: 9,
        visitCode: '1234',
        status: 'reserved',
        client: { id: 5, name: 'Алия', phone: '+77001234567' },
        startDateTime: new Date('2026-10-20T00:00:00.000Z'),
        endDateTime: new Date('2026-10-21T00:00:00.000Z'),
        issueTimeFrom: '10:00',
        issueTimeTo: '12:00',
        returnTimeUntil: '18:00',
        createdAt: new Date('2026-10-01T10:00:00.000Z'),
        orders: [
          {
            rentPrice: 5000,
            prepaymentAmount: 1000,
            child: { name: 'Дана' },
            costume: { name: 'Принцесса', inventoryCode: 'C-0015' },
          },
          {
            rentPrice: 3000,
            prepaymentAmount: 500,
            child: { name: 'Аян' },
            costume: { name: 'Рыцарь', inventoryCode: 'C-0020' },
          },
        ],
      },
    ]);
    prisma.visit.count.mockResolvedValue(1);

    const result = await service.list({ page: 1, limit: 20 });

    expect(result.items[0]).toMatchObject({
      id: 9,
      childrenNames: 'Дана, Аян',
      costumesNames: 'Принцесса, Рыцарь',
      orderCount: 2,
      totalRent: 8000,
      totalPrepayment: 1500,
      totalRemaining: 6500,
    });
  });

  it('searches visit code, client, phone, child, costume, and inventory code', async () => {
    prisma.visit.findMany.mockResolvedValue([]);
    prisma.visit.count.mockResolvedValue(0);

    await service.list({ q: 'ali' });

    const calls = prisma.visit.findMany.mock.calls as unknown as Array<
      [{ where: { OR: unknown[] } }]
    >;
    const call = calls[0]?.[0];
    const filters = call.where.OR;
    expect(filters.length).toBeGreaterThan(5);
    const hasKey = (key: string) =>
      filters.some(
        (filter) =>
          typeof filter === 'object' &&
          filter !== null &&
          Object.hasOwn(filter, key),
      );
    expect(hasKey('visitCode')).toBe(true);
    expect(hasKey('client')).toBe(true);
    expect(hasKey('orders')).toBe(true);
    const filterJson = JSON.stringify(filters);
    expect(filterJson).not.toContain('phone');
    expect(filterJson).toContain('child');
    expect(filterJson).toContain('costume');
    expect(filterJson).toContain('inventoryCode');
  });

  it('adds phone filters for numeric search queries', async () => {
    prisma.visit.findMany.mockResolvedValue([]);
    prisma.visit.count.mockResolvedValue(0);

    await service.list({ q: '7700' });

    const calls = prisma.visit.findMany.mock.calls as unknown as Array<
      [{ where: { OR: unknown[] } }]
    >;
    expect(JSON.stringify(calls[0]?.[0].where.OR)).toContain('phone');
  });

  it.each([
    [{ page: 0 }, 'Номер страницы должен быть не меньше 1'],
    [{ limit: 101 }, 'Размер страницы должен быть от 1 до 100'],
    [{ q: 'a' }, 'не менее 2 символов'],
    [{ q: ['aa', 'bb'] }, 'по одному значению'],
    [{ status: ['issued', 'cancelled'] }, 'по одному значению'],
    [{ startDateFrom: '2026-02-30' }, 'корректную дату в формате'],
    [
      { startDateFrom: '2026-11-02', startDateTo: '2026-11-01' },
      'не может быть раньше',
    ],
    [{ status: 'unknown' }, 'неизвестный статус визита'],
  ])('rejects invalid query %j', async (query, message) => {
    await expect(service.list(query as never)).rejects.toThrow(message);
    expect(prisma.visit.findMany).not.toHaveBeenCalled();
  });

  it('maps detail snapshots and calculates balance only after issue', async () => {
    prisma.visit.findFirst.mockResolvedValue({
      id: 9,
      visitCode: '1234',
      status: 'issued',
      version: 3,
      client: { id: 5, name: 'Алия', phone: '+77001234567' },
      startDateTime: new Date('2026-10-20T00:00:00.000Z'),
      endDateTime: new Date('2026-10-21T00:00:00.000Z'),
      issueTimeFrom: '10:00',
      issueTimeTo: '12:00',
      returnTimeUntil: '18:00',
      notes: null,
      createdAt: new Date('2026-10-01T10:00:00.000Z'),
      orders: [
        {
          id: 15,
          childId: 6,
          costumeId: 7,
          status: 'issued',
          tagStatus: 'written',
          rentPrice: 5000,
          prepaymentAmount: 1000,
          finalPayment: null,
          notes: null,
          child: { name: 'Дана' },
          costume: { name: 'Принцесса', inventoryCode: 'C-0015' },
        },
      ],
      moneyOperations: [
        {
          id: 21,
          kind: 'issue_payment',
          amount: 1000,
          createdAt: new Date('2026-10-01T10:01:00.000Z'),
          voidedAt: null,
          legacyImported: false,
        },
      ],
      deposits: [
        {
          id: 27,
          type: 'cash',
          amount: 5000,
          returned: false,
          createdAt: new Date('2026-10-01T10:02:00.000Z'),
        },
      ],
    });

    const result = await service.detail(9);

    expect(result.version).toBe(3);
    expect(result.orders[0]).toMatchObject({
      orderId: 15,
      childId: 6,
      costumeId: 7,
      childName: 'Дана',
      costumeName: 'Принцесса',
      inventoryCode: 'C-0015',
    });
    expect(result.balance).toMatchObject({ totalRent: 5000, debt: 3000 });
    const calls = prisma.visit.findFirst.mock.calls as unknown as Array<
      [
        {
          where: { id: number; deletedAt: null };
          include: {
            orders: { where: { deletedAt: null } };
            deposits: { where: { deletedAt: null } };
          };
        },
      ]
    >;
    expect(calls[0]?.[0]).toMatchObject({
      where: { id: 9, deletedAt: null },
      include: {
        orders: { where: { deletedAt: null } },
        deposits: { where: { deletedAt: null } },
      },
    });
  });

  it('does not include a balance for reserved visits', async () => {
    prisma.visit.findFirst.mockResolvedValue({
      id: 9,
      visitCode: '1234',
      status: 'reserved',
      version: 1,
      client: { id: 5, name: 'Алия', phone: '+77001234567' },
      startDateTime: new Date('2026-10-20T00:00:00.000Z'),
      endDateTime: new Date('2026-10-21T00:00:00.000Z'),
      issueTimeFrom: '10:00',
      issueTimeTo: '12:00',
      returnTimeUntil: '18:00',
      notes: null,
      createdAt: new Date('2026-10-01T10:00:00.000Z'),
      orders: [],
      moneyOperations: [],
      deposits: [],
    });

    const result = await service.detail(9);
    expect(result).not.toHaveProperty('balance');
  });

  it('hides soft-deleted visits', async () => {
    prisma.visit.findFirst.mockResolvedValue(null);
    await expect(service.detail(9)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.visit.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 9, deletedAt: null } }),
    );
  });
});

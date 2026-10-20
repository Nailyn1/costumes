import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CostumesService } from './costumes.service';
import {
  createPrismaMock,
  makeCostume,
  makeOrder,
  makeVisit,
} from '../test-utils';

const { prisma, reset } = createPrismaMock();
const service = () => new CostumesService(prisma as never);
const start = '2026-12-20T10:00:00Z';
const end = '2026-12-21T10:00:00Z';

describe('CostumesService', () => {
  beforeEach(reset);

  it('creates a costume and returns the database generated inventory code', async () => {
    prisma.costume.create.mockResolvedValue(makeCostume());
    await expect(service().createCostume({ name: 'Эльза' })).resolves.toEqual({
      costumeId: 1,
      name: 'Эльза',
      inventoryCode: 'C-0001',
    });
    expect(prisma.costume.create).toHaveBeenCalledWith({
      data: { name: 'Эльза' },
    });
  });

  it('updates a costume name', async () => {
    prisma.costume.update.mockResolvedValue(makeCostume({ name: 'Анна' }));
    await expect(
      service().updateCostume({ name: 'Анна' }, 1),
    ).resolves.toMatchObject({
      name: 'Анна',
      inventoryCode: 'C-0001',
    });
    expect(prisma.costume.update).toHaveBeenCalledWith({
      where: { id: 1, deletedAt: null },
      data: { name: 'Анна' },
    });
  });

  it('rejects updating a costume that was already deleted', async () => {
    prisma.costume.update.mockRejectedValue({ code: 'P2025' });
    await expect(service().updateCostume({ name: 'Анна' }, 1)).rejects.toThrow(
      new NotFoundException('Костюм с ID 1 не найден'),
    );
    expect(prisma.costume.update).toHaveBeenCalledWith({
      where: { id: 1, deletedAt: null },
      data: { name: 'Анна' },
    });
  });

  it('soft deletes a costume', async () => {
    prisma.costume.update.mockResolvedValue(
      makeCostume({ deletedAt: new Date() }),
    );
    await service().deleteCostume(1);
    expect(prisma.costume.update).toHaveBeenCalledWith({
      where: { id: 1, deletedAt: null },
      data: { deletedAt: expect.any(Date) as never },
    });
  });

  it('rejects deleting a costume that was already deleted', async () => {
    prisma.costume.update.mockRejectedValue({ code: 'P2025' });
    await expect(service().deleteCostume(1)).rejects.toThrow(
      new NotFoundException('Костюм с ID 1 не найден'),
    );
    expect(prisma.costume.update).toHaveBeenCalledWith({
      where: { id: 1, deletedAt: null },
      data: { deletedAt: expect.any(Date) as never },
    });
  });

  it('searches by name and inventory code and ranks exact matches first', async () => {
    const exact = makeCostume({ id: 1, name: 'Эльза', orders: [] } as never);
    const prefix = makeCostume({
      id: 2,
      name: 'Эльза снежная',
      orders: [],
    } as never);
    const word = makeCostume({
      id: 3,
      name: 'Платье Эльза',
      orders: [],
    } as never);
    prisma.costume.findMany.mockResolvedValue([word, prefix, exact]);

    const result = await service().searchCostume(' ЭЛЬЗА ');

    expect(result.map((item) => item.costumeId)).toEqual([1, 2, 3]);
    expect(prisma.costume.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }) as never,
        take: 20,
      }) as never,
    );
    prisma.costume.findMany.mockClear();
    prisma.costume.findMany.mockResolvedValue([exact]);
    await expect(service().searchCostume(' C-0001 ')).resolves.toMatchObject([
      { costumeId: 1, inventoryCode: 'C-0001' },
    ]);
    expect(prisma.costume.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }) as never,
      }) as never,
    );
  });

  it('does not query for a search shorter than two characters', async () => {
    await expect(service().searchCostume(' э ')).resolves.toEqual([]);
    expect(prisma.costume.findMany).not.toHaveBeenCalled();
  });

  it('rejects an invalid availability period', async () => {
    await expect(
      service().searchCostumeAvailable('Эльза', end, start),
    ).rejects.toThrow(
      new BadRequestException(
        'Дата возврата должна быть строго позже даты выдачи',
      ),
    );
    expect(prisma.costume.findMany).not.toHaveBeenCalled();
  });

  it('queries only non-cancelled orders that overlap the requested period', async () => {
    const busy = makeCostume({
      id: 1,
      orders: [
        { status: 'reserved', visit: makeVisit({ status: 'reserved' }) },
      ],
    } as never);
    const free = makeCostume({ id: 2, orders: [] } as never);
    prisma.costume.findMany.mockResolvedValue([busy, free]);

    const result = await service().searchCostumeAvailable('Эльза', start, end);

    expect(result.map((item) => item.status)).toEqual(['issued', 'available']);
    expect(prisma.costume.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }) as never,
        include: {
          orders: {
            where: {
              deletedAt: null,
              status: { in: ['reserved', 'issued'] },
              visit: {
                status: { not: 'cancelled' },
                deletedAt: null,
                AND: [
                  { startDateTime: { lt: new Date(end) } },
                  { endDateTime: { gt: new Date(start) } },
                ],
              },
            },
            include: { visit: true },
          },
        },
      }) as never,
    );
  });

  it('returns active availability periods ordered by start date without financial fields', async () => {
    const later = makeOrder({
      id: 2,
      startDateTime: new Date('2026-12-22T10:00:00Z'),
    });
    const earlier = makeOrder({
      id: 1,
      startDateTime: new Date('2026-12-20T10:00:00Z'),
    });
    prisma.costume.findUnique.mockResolvedValue(
      makeCostume({
        orders: [
          {
            ...earlier,
            visit: makeVisit({ visitCode: '4321' }),
            child: { name: 'Маша' },
            client: { name: 'Алия', phone: '+77071111111' },
          },
          {
            ...later,
            visit: makeVisit(),
            child: { name: 'Соня' },
            client: { name: 'Оля', phone: '+77070000000' },
          },
        ],
      } as never),
    );

    const result = await service().costumesAvailability(1);
    expect(result.periods.map((period) => period.startDateTime)).toEqual([
      '2026-12-20',
      '2026-12-22',
    ]);
    expect(result.periods[0]).toMatchObject({
      visitCode: '4321',
      childName: 'Маша',
      clientPhone: '+77071111111',
    });
    expect(result.periods[0]).not.toHaveProperty('rentPrice');
    expect(prisma.costume.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1, deletedAt: null },
        include: expect.objectContaining({
          orders: expect.objectContaining({
            where: {
              deletedAt: null,
              status: { in: ['reserved', 'issued'] },
              visit: { deletedAt: null, status: { not: 'cancelled' } },
            },
            orderBy: { startDateTime: 'asc' },
          }) as never,
        }) as never,
      }) as never,
    );
  });

  it('returns an empty availability message when there are no active orders', async () => {
    prisma.costume.findUnique.mockResolvedValue(
      makeCostume({ orders: [] } as never),
    );
    await expect(service().costumesAvailability(1)).resolves.toMatchObject({
      periods: [],
      noPeriodsMessage: 'На выбранный костюм активных броней не найдено',
    });
  });

  it('rejects a deleted costume in availability lookup', async () => {
    prisma.costume.findUnique.mockResolvedValue(null);
    await expect(service().costumesAvailability(1)).rejects.toThrow(
      new NotFoundException('Костюм с ID 1 не найден'),
    );
    expect(prisma.costume.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1, deletedAt: null },
      }) as never,
    );
  });

  it('paginates costume list and filters deleted rows', async () => {
    prisma.$transaction.mockResolvedValue([
      [{ id: 2, name: 'Анна', inventoryCode: 'C-0002' }],
      5,
    ]);
    await expect(service().getCostumesList(2, 2)).resolves.toEqual({
      items: [{ costumeId: 2, name: 'Анна', inventoryCode: 'C-0002' }],
      total: 5,
      page: 2,
      limit: 2,
      hasMore: true,
    });
    expect(prisma.costume.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null },
        skip: 2,
        take: 2,
        orderBy: { id: 'desc' },
      }),
    );
    expect(prisma.costume.count).toHaveBeenCalledWith({
      where: { deletedAt: null },
    });
  });

  it('excludes returned orders from availability search and costume periods (T-024)', async () => {
    prisma.costume.findMany.mockResolvedValue([
      makeCostume({ orders: [] } as never),
    ]);
    await service().searchCostumeAvailable('Эльза', start, end);

    expect(prisma.costume.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          orders: expect.objectContaining({
            where: expect.objectContaining({
              status: { in: ['reserved', 'issued'] },
            }) as never,
          }) as never,
        },
      }) as never,
    );

    prisma.costume.findMany.mockClear();
    prisma.costume.findUnique.mockResolvedValue(
      makeCostume({ orders: [] } as never),
    );
    await service().costumesAvailability(1);

    expect(prisma.costume.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          orders: expect.objectContaining({
            where: expect.objectContaining({
              status: { in: ['reserved', 'issued'] },
            }) as never,
          }) as never,
        },
      }) as never,
    );
  });
  it('determines availability from active orders without a stored costume status (T-025)', async () => {
    prisma.costume.findMany.mockResolvedValue([
      makeCostume({
        orders: [{ status: 'issued', visit: makeVisit() }],
      } as never),
    ]);
    await expect(
      service().searchCostumeAvailable('Эльза', start, end),
    ).resolves.toMatchObject([{ status: 'issued' }]);
  });

  it('filters deleted related orders and visits while searching available costumes (T-078)', async () => {
    prisma.costume.findMany.mockResolvedValue([
      makeCostume({
        orders: [
          {
            status: 'reserved',
            deletedAt: new Date(),
            visit: makeVisit({ status: 'reserved' }),
          },
          {
            status: 'reserved',
            visit: makeVisit({ deletedAt: new Date(), status: 'reserved' }),
          },
        ],
      } as never),
    ]);

    await service().searchCostumeAvailable('Эльза', start, end);

    expect(prisma.costume.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          orders: {
            where: {
              deletedAt: null,
              status: { in: ['reserved', 'issued'] },
              visit: {
                deletedAt: null,
                status: { not: 'cancelled' },
                AND: [
                  { startDateTime: { lt: new Date(end) } },
                  { endDateTime: { gt: new Date(start) } },
                ],
              },
            },
            include: { visit: true },
          },
        },
      }) as never,
    );
  });
});

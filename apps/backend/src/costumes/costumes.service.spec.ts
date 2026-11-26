import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CostumesService } from './costumes.service';
import { CostumesRepository } from './costumes.repository';
import {
  createPrismaMock,
  noPhotos,
  makeCostume,
  makeOrder,
  makeVisit,
} from '../test-utils';

const { prisma, tx, reset } = createPrismaMock();
const service = () =>
  new CostumesService(
    new CostumesRepository(prisma as never),
    noPhotos as never,
  );
const start = '2026-12-20T10:00:00Z';
const end = '2026-12-21T10:00:00Z';

describe('CostumesService', () => {
  beforeEach(reset);

  it('creates a costume and returns the database generated inventory code', async () => {
    prisma.costume.create.mockResolvedValue(makeCostume());
    await expect(service().createCostume({ name: 'Эльза' })).resolves.toEqual({
      costumeId: 1,
      name: 'Эльза',
      photoCount: 0,
      inventoryCode: 'C-0001',
      category: null,
      gender: null,
      heightFrom: null,
      heightTo: null,
      sizeLabel: null,
      parts: [],
    });
    expect(prisma.costume.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Эльза' }) as never,
      }) as never,
    );
  });

  it('creates a costume with category, gender and size and returns the category with its parent', async () => {
    prisma.costumeCategory.findFirst.mockResolvedValue({ id: 3 });
    prisma.costume.create.mockResolvedValue(
      makeCostume({
        categoryId: 3,
        gender: 'girl',
        heightFrom: 104,
        heightTo: 116,
        sizeLabel: 'Р32',
        category: {
          id: 3,
          name: 'Кавказские',
          parentId: 1,
          deletedAt: null,
          parent: { name: 'Национальные' },
        },
      } as never),
    );

    await expect(
      service().createCostume({
        name: 'Кавказский',
        categoryId: 3,
        gender: 'girl',
        heightFrom: 104,
        heightTo: 116,
        sizeLabel: ' Р32 ',
      }),
    ).resolves.toMatchObject({
      category: {
        id: 3,
        name: 'Кавказские',
        parentId: 1,
        parentName: 'Национальные',
      },
      gender: 'girl',
      heightFrom: 104,
      heightTo: 116,
      sizeLabel: 'Р32',
    });
    expect(prisma.costumeCategory.findFirst).toHaveBeenCalledWith({
      where: { id: 3, deletedAt: null },
      select: { id: true },
    });
    expect(prisma.costume.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          name: 'Кавказский',
          categoryId: 3,
          gender: 'girl',
          heightFrom: 104,
          heightTo: 116,
          sizeLabel: 'Р32',
        },
      }) as never,
    );
  });

  it('does not report a soft deleted category on the costume', async () => {
    prisma.costume.create.mockResolvedValue(
      makeCostume({
        categoryId: 3,
        category: {
          id: 3,
          name: 'Кавказские',
          parentId: 1,
          deletedAt: new Date(),
          parent: null,
        },
      } as never),
    );
    await expect(
      service().createCostume({ name: 'Кавказский' }),
    ).resolves.toMatchObject({ category: null });
  });

  it('rejects an inverted height range and an unknown category on create', async () => {
    await expect(
      service().createCostume({
        name: 'Кавказский',
        heightFrom: 120,
        heightTo: 104,
      }),
    ).rejects.toThrow(BadRequestException);

    prisma.costumeCategory.findFirst.mockResolvedValue(null);
    await expect(
      service().createCostume({ name: 'Кавказский', categoryId: 99 }),
    ).rejects.toThrow(new BadRequestException('Категория с ID 99 не найдена'));
    expect(prisma.costume.create).not.toHaveBeenCalled();
  });

  it('validates an updated height bound against the stored one', async () => {
    prisma.costume.findFirst.mockResolvedValue({
      heightFrom: 104,
      heightTo: 116,
    });
    await expect(service().updateCostume({ heightTo: 100 }, 1)).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.costume.update).not.toHaveBeenCalled();

    prisma.costume.update.mockResolvedValue(makeCostume({ heightTo: 120 }));
    await service().updateCostume({ heightTo: 120 }, 1);
    expect(prisma.costume.update).toHaveBeenCalledTimes(1);
  });

  it('clears the category and size label with null', async () => {
    prisma.costume.update.mockResolvedValue(makeCostume());
    await service().updateCostume({ categoryId: null, sizeLabel: null }, 1);
    expect(prisma.costume.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          categoryId: null,
          sizeLabel: null,
        }) as never,
      }) as never,
    );
  });

  it('combines catalog filters with search without losing exact matches', async () => {
    prisma.costume.findMany.mockResolvedValue([]);
    await service().searchCostume('Эльза', { categoryId: 2, gender: 'girl' });

    const calls = prisma.costume.findMany.mock.calls as [
      { where: { AND: unknown[]; deletedAt: null } },
    ][];
    expect(calls).toHaveLength(2);
    for (const [args] of calls) {
      expect(args.where.deletedAt).toBeNull();
      expect(args.where.AND).toHaveLength(3);
      expect(args.where.AND).toEqual(
        expect.arrayContaining([
          { category: { deletedAt: null, OR: [{ id: 2 }, { parentId: 2 }] } },
          { gender: 'girl' },
        ]),
      );
    }
  });

  it('applies catalog filters to the availability search and the list', async () => {
    prisma.costume.findMany.mockResolvedValue([]);
    await service().searchCostumeAvailable('Эльза', start, end, undefined, {
      withoutCategory: true,
    });
    for (const [args] of prisma.costume.findMany.mock.calls as [
      { where: { AND: unknown[] } },
    ][]) {
      expect(args.where.AND[0]).toEqual({
        OR: [{ categoryId: null }, { category: { deletedAt: { not: null } } }],
      });
    }

    prisma.costume.findMany.mockClear();
    prisma.$transaction.mockResolvedValue([[], 0]);
    await service().getCostumesList(1, 20, { height: 110 });
    expect(prisma.costume.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null, AND: expect.any(Array) as never },
      }) as never,
    );
    expect(prisma.costume.count).toHaveBeenCalledWith({
      where: { deletedAt: null, AND: expect.any(Array) as never },
    });
  });

  it('stores the parts with trimmed names and leaves them untouched when omitted', async () => {
    prisma.costume.create.mockResolvedValue(makeCostume());
    await service().createCostume({
      name: 'Эльза',
      parts: [{ name: ' Накидка ', qty: 1 }],
    });
    expect(prisma.costume.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          parts: [{ name: 'Накидка', qty: 1 }],
        }) as never,
      }) as never,
    );

    prisma.costume.update.mockResolvedValue(makeCostume());
    await service().updateCostume({ name: 'Анна' }, 1);
    expect(prisma.costume.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ parts: undefined }) as never,
      }) as never,
    );
  });

  it('rejects blank and duplicate part names without saving', async () => {
    await expect(
      service().createCostume({
        name: 'Эльза',
        parts: [{ name: '  ', qty: 1 }],
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service().updateCostume(
        {
          parts: [
            { name: 'Пояс', qty: 1 },
            { name: 'пояс', qty: 2 },
          ],
        },
        1,
      ),
    ).rejects.toThrow(
      new BadRequestException('Часть «пояс» указана в составе дважды'),
    );
    expect(prisma.costume.create).not.toHaveBeenCalled();
    expect(prisma.costume.update).not.toHaveBeenCalled();
  });

  it('updates a costume name', async () => {
    prisma.costume.update.mockResolvedValue(makeCostume({ name: 'Анна' }));
    await expect(
      service().updateCostume({ name: 'Анна' }, 1),
    ).resolves.toMatchObject({
      name: 'Анна',
      inventoryCode: 'C-0001',
    });
    expect(prisma.costume.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1, deletedAt: null },
        data: expect.objectContaining({ name: 'Анна' }) as never,
      }) as never,
    );
  });

  it('rejects updating a costume that was already deleted', async () => {
    prisma.costume.update.mockRejectedValue({ code: 'P2025' });
    await expect(service().updateCostume({ name: 'Анна' }, 1)).rejects.toThrow(
      new NotFoundException('Костюм с ID 1 не найден'),
    );
    expect(prisma.costume.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1, deletedAt: null },
        data: expect.objectContaining({ name: 'Анна' }) as never,
      }) as never,
    );
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
          category: expect.anything() as never,
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
    await expect(service().getCostumesList(2, 2)).resolves.toMatchObject({
      items: [{ costumeId: 2, name: 'Анна', inventoryCode: 'C-0002' }],
      total: 5,
      page: 2,
      limit: 2,
      hasMore: true,
    });
    expect(prisma.costume.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null, AND: [] },
        skip: 2,
        take: 2,
        orderBy: { id: 'desc' },
      }),
    );
    expect(prisma.costume.count).toHaveBeenCalledWith({
      where: { deletedAt: null, AND: [] },
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
          category: expect.anything() as never,
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
          category: expect.anything() as never,
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
          category: expect.anything() as never,
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

const category = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  name: 'Национальные',
  parentId: null,
  sortOrder: 1,
  deletedAt: null,
  ...overrides,
});

describe('CostumesService categories', () => {
  beforeEach(reset);

  it('lists active main categories with their active subcategories', async () => {
    prisma.costumeCategory.findMany.mockResolvedValue([
      {
        ...category(),
        children: [category({ id: 3, name: 'Кавказские', parentId: 1 })],
      },
    ]);

    await expect(service().listCategories()).resolves.toEqual([
      {
        id: 1,
        name: 'Национальные',
        sortOrder: 1,
        children: [{ id: 3, name: 'Кавказские', sortOrder: 1 }],
      },
    ]);
    expect(prisma.costumeCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { parentId: null, deletedAt: null },
        include: {
          children: expect.objectContaining({
            where: { deletedAt: null },
          }) as never,
        },
      }) as never,
    );
  });

  it('creates a main category at the end of the list', async () => {
    prisma.costumeCategory.findFirst
      .mockResolvedValueOnce(null) // нет дубля
      .mockResolvedValueOnce({ sortOrder: 2 }); // последний по порядку
    prisma.costumeCategory.create.mockResolvedValue(
      category({ id: 5, name: 'Сказочные', sortOrder: 3 }),
    );

    await service().createCategory({ name: ' Сказочные ' });

    expect(prisma.costumeCategory.create).toHaveBeenCalledWith({
      data: { name: 'Сказочные', parentId: null, sortOrder: 3 },
    });
  });

  it('creates a subcategory under a main category', async () => {
    prisma.costumeCategory.findFirst
      .mockResolvedValueOnce(category()) // родитель
      .mockResolvedValueOnce(null) // нет дубля
      .mockResolvedValueOnce(null); // первая подкатегория
    prisma.costumeCategory.create.mockResolvedValue(
      category({ id: 9, name: 'Ирландские', parentId: 1, sortOrder: 1 }),
    );

    await expect(
      service().createCategory({ name: 'Ирландские', parentId: 1 }),
    ).resolves.toMatchObject({ id: 9, parentId: 1 });
    expect(prisma.costumeCategory.create).toHaveBeenCalledWith({
      data: { name: 'Ирландские', parentId: 1, sortOrder: 1 },
    });
  });

  it('rejects a subcategory inside another subcategory', async () => {
    prisma.costumeCategory.findFirst.mockResolvedValue(
      category({ id: 3, parentId: 1 }),
    );
    await expect(
      service().createCategory({ name: 'Глубже', parentId: 3 }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.costumeCategory.create).not.toHaveBeenCalled();
  });

  it('rejects a deleted or missing parent as not found', async () => {
    prisma.costumeCategory.findFirst.mockResolvedValue(null);
    await expect(
      service().createCategory({ name: 'Новая', parentId: 99 }),
    ).rejects.toThrow(new NotFoundException('Категория с ID 99 не найдена'));
    expect(prisma.costumeCategory.findFirst).toHaveBeenCalledWith({
      where: { id: 99, deletedAt: null },
    });
  });

  it('rejects a duplicate name among active siblings ignoring case', async () => {
    prisma.costumeCategory.findFirst.mockResolvedValue({ id: 7 });
    await expect(
      service().createCategory({ name: 'новогодние' }),
    ).rejects.toThrow(
      new ConflictException('Категория «новогодние» уже существует'),
    );
    expect(prisma.costumeCategory.findFirst).toHaveBeenCalledWith({
      where: {
        parentId: null,
        deletedAt: null,
        name: { equals: 'новогодние', mode: 'insensitive' },
      },
      select: { id: true },
    });
    expect(prisma.costumeCategory.create).not.toHaveBeenCalled();
  });

  it('renames a category and excludes itself from the duplicate check', async () => {
    prisma.costumeCategory.findFirst
      .mockResolvedValueOnce(category({ id: 3, parentId: 1, name: 'Кавказ' }))
      .mockResolvedValueOnce(null);
    prisma.costumeCategory.update.mockResolvedValue(
      category({ id: 3, parentId: 1, name: 'Кавказские' }),
    );

    await service().updateCategory(3, { name: 'Кавказские', sortOrder: 4 });

    expect(prisma.costumeCategory.findFirst).toHaveBeenLastCalledWith({
      where: {
        parentId: 1,
        deletedAt: null,
        name: { equals: 'Кавказские', mode: 'insensitive' },
        id: { not: 3 },
      },
      select: { id: true },
    });
    expect(prisma.costumeCategory.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { name: 'Кавказские', sortOrder: 4 },
    });
  });

  it('rejects updating a deleted category', async () => {
    prisma.costumeCategory.findFirst.mockResolvedValue(null);
    await expect(
      service().updateCategory(3, { name: 'Другое' }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.costumeCategory.update).not.toHaveBeenCalled();
  });

  it('refuses to delete a category with active subcategories', async () => {
    prisma.costumeCategory.findFirst.mockResolvedValue(category());
    prisma.costumeCategory.count.mockResolvedValue(2);

    await expect(service().deleteCategory(1)).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.costumeCategory.count).toHaveBeenCalledWith({
      where: { parentId: 1, deletedAt: null },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('soft deletes a category and leaves its costumes uncategorized', async () => {
    prisma.costumeCategory.findFirst.mockResolvedValue(
      category({ id: 3, parentId: 1 }),
    );
    prisma.costumeCategory.count.mockResolvedValue(0);

    await service().deleteCategory(3);

    expect(tx.costume.updateMany).toHaveBeenCalledWith({
      where: { categoryId: 3 },
      data: { categoryId: null },
    });
    expect(tx.costumeCategory.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { deletedAt: expect.any(Date) as never },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

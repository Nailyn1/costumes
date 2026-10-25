import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CostumeCategoriesService } from './costume-categories.service';
import { createPrismaMock } from '../test-utils';

const { prisma, tx, reset } = createPrismaMock();
const service = () => new CostumeCategoriesService(prisma as never);

const category = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  name: 'Национальные',
  parentId: null,
  sortOrder: 1,
  deletedAt: null,
  ...overrides,
});

describe('CostumeCategoriesService', () => {
  beforeEach(reset);

  it('lists active main categories with their active subcategories', async () => {
    prisma.costumeCategory.findMany.mockResolvedValue([
      {
        ...category(),
        children: [category({ id: 3, name: 'Кавказские', parentId: 1 })],
      },
    ]);

    await expect(service().list()).resolves.toEqual([
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

    await service().create({ name: ' Сказочные ' });

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
      service().create({ name: 'Ирландские', parentId: 1 }),
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
      service().create({ name: 'Глубже', parentId: 3 }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.costumeCategory.create).not.toHaveBeenCalled();
  });

  it('rejects a deleted or missing parent as not found', async () => {
    prisma.costumeCategory.findFirst.mockResolvedValue(null);
    await expect(
      service().create({ name: 'Новая', parentId: 99 }),
    ).rejects.toThrow(new NotFoundException('Категория с ID 99 не найдена'));
    expect(prisma.costumeCategory.findFirst).toHaveBeenCalledWith({
      where: { id: 99, deletedAt: null },
    });
  });

  it('rejects a duplicate name among active siblings ignoring case', async () => {
    prisma.costumeCategory.findFirst.mockResolvedValue({ id: 7 });
    await expect(service().create({ name: 'новогодние' })).rejects.toThrow(
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

    await service().update(3, { name: 'Кавказские', sortOrder: 4 });

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
    await expect(service().update(3, { name: 'Другое' })).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.costumeCategory.update).not.toHaveBeenCalled();
  });

  it('refuses to delete a category with active subcategories', async () => {
    prisma.costumeCategory.findFirst.mockResolvedValue(category());
    prisma.costumeCategory.count.mockResolvedValue(2);

    await expect(service().remove(1)).rejects.toThrow(ConflictException);
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

    await service().remove(3);

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

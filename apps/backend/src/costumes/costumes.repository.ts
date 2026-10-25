import { Injectable } from '@nestjs/common';
import { Prisma } from '../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { costumeCatalogInclude } from './costume.mapper';

const searchInclude = {
  ...costumeCatalogInclude,
  orders: {
    where: { deletedAt: null },
    include: { child: true, visit: true },
  },
} satisfies Prisma.CostumeInclude;

const listSelect = {
  id: true,
  name: true,
  inventoryCode: true,
  gender: true,
  heightFrom: true,
  heightTo: true,
  sizeLabel: true,
  parts: true,
  category: costumeCatalogInclude.category,
} satisfies Prisma.CostumeSelect;

const byOrder = [{ sortOrder: 'asc' }, { id: 'asc' }] as const;

/** Доступ к данным костюмов и справочника категорий; бизнес-правил здесь нет. */
@Injectable()
export class CostumesRepository {
  constructor(private readonly prisma: PrismaService) {}

  // --- костюмы ---

  create(data: Prisma.CostumeUncheckedCreateInput) {
    return this.prisma.costume.create({
      data,
      include: costumeCatalogInclude,
    });
  }

  /** `null`, если костюма нет или он удалён. */
  async update(id: number, data: Prisma.CostumeUncheckedUpdateInput) {
    try {
      return await this.prisma.costume.update({
        where: { id, deletedAt: null },
        data,
        include: costumeCatalogInclude,
      });
    } catch (err) {
      if ((err as { code?: string }).code === 'P2025') return null;
      throw err;
    }
  }

  /** `false`, если костюма нет или он уже удалён. */
  async softDelete(id: number): Promise<boolean> {
    try {
      await this.prisma.costume.update({
        where: { id, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      return true;
    } catch {
      return false;
    }
  }

  findHeightRange(id: number) {
    return this.prisma.costume.findFirst({
      where: { id, deletedAt: null },
      select: { heightFrom: true, heightTo: true },
    });
  }

  /** Широкий поиск с заказами для ранжирования по ребёнку и коду визита. */
  searchWithOrders(where: Prisma.CostumeWhereInput, take: number) {
    return this.prisma.costume.findMany({
      where,
      include: searchInclude,
      take,
    });
  }

  /** Поиск для брони: в `orders` только заказы, пересекающие период. */
  searchWithBusyOrders(
    where: Prisma.CostumeWhereInput,
    take: number,
    busyOrders: Prisma.CostumeInclude['orders'],
  ) {
    return this.prisma.costume.findMany({
      where,
      include: { ...costumeCatalogInclude, orders: busyOrders },
      take,
    });
  }

  findWithActiveOrders(id: number) {
    return this.prisma.costume.findUnique({
      where: { id, deletedAt: null },
      include: {
        ...costumeCatalogInclude,
        orders: {
          where: {
            status: { in: ['reserved', 'issued'] },
            deletedAt: null,
            visit: { deletedAt: null, status: { not: 'cancelled' } },
          },
          include: { visit: true, child: true, client: true },
          orderBy: { startDateTime: 'asc' },
        },
      },
    });
  }

  listPage(where: Prisma.CostumeWhereInput, skip: number, take: number) {
    return this.prisma.$transaction([
      this.prisma.costume.findMany({
        where,
        skip,
        take,
        select: listSelect,
        orderBy: { id: 'desc' },
      }),
      this.prisma.costume.count({ where }),
    ]);
  }

  findActiveVisit(id: number) {
    return this.prisma.visit.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, status: true },
    });
  }

  // --- категории ---

  listRootCategories() {
    return this.prisma.costumeCategory.findMany({
      where: { parentId: null, deletedAt: null },
      include: {
        children: { where: { deletedAt: null }, orderBy: [...byOrder] },
      },
      orderBy: [...byOrder],
    });
  }

  findActiveCategory(id: number) {
    return this.prisma.costumeCategory.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async categoryExists(id: number): Promise<boolean> {
    const found = await this.prisma.costumeCategory.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    return found !== null;
  }

  /** Активная категория с таким именем среди «соседей» (без учёта регистра). */
  async categoryNameTaken(
    name: string,
    parentId: number | null,
    exceptId?: number,
  ): Promise<boolean> {
    const found = await this.prisma.costumeCategory.findFirst({
      where: {
        parentId,
        deletedAt: null,
        name: { equals: name, mode: 'insensitive' },
        ...(exceptId === undefined ? {} : { id: { not: exceptId } }),
      },
      select: { id: true },
    });
    return found !== null;
  }

  async lastCategorySortOrder(parentId: number | null): Promise<number> {
    const last = await this.prisma.costumeCategory.findFirst({
      where: { parentId, deletedAt: null },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    return last?.sortOrder ?? 0;
  }

  createCategory(data: {
    name: string;
    parentId: number | null;
    sortOrder: number;
  }) {
    return this.prisma.costumeCategory.create({ data });
  }

  updateCategory(id: number, data: { name?: string; sortOrder?: number }) {
    return this.prisma.costumeCategory.update({ where: { id }, data });
  }

  countActiveSubcategories(parentId: number) {
    return this.prisma.costumeCategory.count({
      where: { parentId, deletedAt: null },
    });
  }

  /** Soft delete; костюмы категории остаются «без категории». */
  softDeleteCategory(id: number) {
    return this.prisma.$transaction(async (tx) => {
      await tx.costume.updateMany({
        where: { categoryId: id },
        data: { categoryId: null },
      });
      await tx.costumeCategory.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    });
  }
}

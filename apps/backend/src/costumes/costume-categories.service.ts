import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CostumeCategoryDto,
  CostumeCategoryNodeDto,
  CreateCostumeCategoryRequestDto,
  UpdateCostumeCategoryRequestDto,
} from '@costumes/shared';
import { PrismaService } from '../prisma/prisma.service';

const byOrder = [{ sortOrder: 'asc' }, { id: 'asc' }] as const;

@Injectable()
export class CostumeCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<CostumeCategoryNodeDto[]> {
    const roots = await this.prisma.costumeCategory.findMany({
      where: { parentId: null, deletedAt: null },
      include: {
        children: { where: { deletedAt: null }, orderBy: [...byOrder] },
      },
      orderBy: [...byOrder],
    });

    return roots.map((root) => ({
      id: root.id,
      name: root.name,
      sortOrder: root.sortOrder,
      children: root.children.map((child) => ({
        id: child.id,
        name: child.name,
        sortOrder: child.sortOrder,
      })),
    }));
  }

  async create(
    data: CreateCostumeCategoryRequestDto,
  ): Promise<CostumeCategoryDto> {
    const name = data.name.trim();
    const parentId = data.parentId ?? null;

    if (parentId !== null) {
      const parent = await this.prisma.costumeCategory.findFirst({
        where: { id: parentId, deletedAt: null },
      });
      if (!parent) {
        throw new NotFoundException(`Категория с ID ${parentId} не найдена`);
      }
      if (parent.parentId !== null) {
        throw new BadRequestException(
          'Подкатегорию нельзя создать внутри другой подкатегории',
        );
      }
    }

    await this.assertNameFree(name, parentId);

    const last = await this.prisma.costumeCategory.findFirst({
      where: { parentId, deletedAt: null },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const created = await this.prisma.costumeCategory.create({
      data: { name, parentId, sortOrder: (last?.sortOrder ?? 0) + 1 },
    });
    return this.toDto(created);
  }

  async update(
    categoryId: number,
    data: UpdateCostumeCategoryRequestDto,
  ): Promise<CostumeCategoryDto> {
    const category = await this.findActive(categoryId);
    const name = data.name?.trim();

    if (name !== undefined && name !== category.name) {
      await this.assertNameFree(name, category.parentId, categoryId);
    }

    const updated = await this.prisma.costumeCategory.update({
      where: { id: categoryId },
      data: { name, sortOrder: data.sortOrder },
    });
    return this.toDto(updated);
  }

  async remove(categoryId: number): Promise<void> {
    await this.findActive(categoryId);

    const activeChildren = await this.prisma.costumeCategory.count({
      where: { parentId: categoryId, deletedAt: null },
    });
    if (activeChildren > 0) {
      throw new ConflictException(
        'Нельзя удалить категорию, пока в ней есть подкатегории',
      );
    }

    // Костюмы удалённой категории остаются «без категории»
    await this.prisma.$transaction(async (tx) => {
      await tx.costume.updateMany({
        where: { categoryId },
        data: { categoryId: null },
      });
      await tx.costumeCategory.update({
        where: { id: categoryId },
        data: { deletedAt: new Date() },
      });
    });
  }

  /** Активная категория по ID — для проверки `categoryId` при сохранении костюма. */
  async assertActive(categoryId: number): Promise<void> {
    const category = await this.prisma.costumeCategory.findFirst({
      where: { id: categoryId, deletedAt: null },
      select: { id: true },
    });
    if (!category) {
      throw new BadRequestException(`Категория с ID ${categoryId} не найдена`);
    }
  }

  private async findActive(categoryId: number) {
    const category = await this.prisma.costumeCategory.findFirst({
      where: { id: categoryId, deletedAt: null },
    });
    if (!category) {
      throw new NotFoundException(`Категория с ID ${categoryId} не найдена`);
    }
    return category;
  }

  private async assertNameFree(
    name: string,
    parentId: number | null,
    exceptId?: number,
  ): Promise<void> {
    const duplicate = await this.prisma.costumeCategory.findFirst({
      where: {
        parentId,
        deletedAt: null,
        name: { equals: name, mode: 'insensitive' },
        ...(exceptId === undefined ? {} : { id: { not: exceptId } }),
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException(`Категория «${name}» уже существует`);
    }
  }

  private toDto(category: {
    id: number;
    name: string;
    parentId: number | null;
    sortOrder: number;
  }): CostumeCategoryDto {
    return {
      id: category.id,
      name: category.name,
      parentId: category.parentId,
      sortOrder: category.sortOrder,
    };
  }
}

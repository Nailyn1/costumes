import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../prisma/generated/client';

export interface CostumeFilters {
  categoryId?: number;
  gender?: 'girl' | 'boy' | 'unisex';
  height?: number;
  withoutCategory?: boolean;
}

/**
 * Условия каталога для выборок костюмов. Складывать с условиями поиска через `AND`,
 * чтобы не затереть `OR` ранжирования.
 */
export function buildCostumeFilterWhere(
  filters: CostumeFilters,
): Prisma.CostumeWhereInput[] {
  const where: Prisma.CostumeWhereInput[] = [];

  if (filters.withoutCategory) {
    if (filters.categoryId !== undefined) {
      throw new BadRequestException(
        'Нельзя одновременно искать в категории и без категории',
      );
    }
    where.push({
      OR: [{ categoryId: null }, { category: { deletedAt: { not: null } } }],
    });
  } else if (filters.categoryId !== undefined) {
    // Основная категория включает свои подкатегории
    where.push({
      category: {
        deletedAt: null,
        OR: [{ id: filters.categoryId }, { parentId: filters.categoryId }],
      },
    });
  }

  if (filters.gender) where.push({ gender: filters.gender });

  if (filters.height !== undefined) {
    const { height } = filters;
    // Одна граница роста трактуется как точный рост
    where.push({
      OR: [
        { heightFrom: { lte: height }, heightTo: { gte: height } },
        { heightFrom: height, heightTo: null },
        { heightFrom: null, heightTo: height },
      ],
    });
  }

  return where;
}

export function assertHeightRange(
  heightFrom: number | null | undefined,
  heightTo: number | null | undefined,
): void {
  if (
    heightFrom !== null &&
    heightFrom !== undefined &&
    heightTo !== null &&
    heightTo !== undefined &&
    heightFrom > heightTo
  ) {
    throw new BadRequestException('Рост «от» не может быть больше роста «до»');
  }
}

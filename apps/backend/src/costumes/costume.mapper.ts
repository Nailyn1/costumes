import { Prisma } from '../prisma/generated/client';
import type { CostumeCategoryRefDto } from '@costumes/shared';
import { parseCostumeParts } from '../common/utils/costume-parts';

/** Категория вместе с названием родителя — для ответов по костюму. */
export const costumeCategorySelect = {
  select: {
    id: true,
    name: true,
    parentId: true,
    deletedAt: true,
    parent: { select: { name: true } },
  },
} satisfies { select: Prisma.CostumeCategorySelect };

export const costumeCatalogInclude = {
  category: costumeCategorySelect,
} satisfies Prisma.CostumeInclude;

type CostumeCategoryRow = Prisma.CostumeCategoryGetPayload<
  typeof costumeCategorySelect
>;

interface CostumeCatalogRow {
  id: number;
  name: string;
  inventoryCode: string;
  category?: CostumeCategoryRow | null;
  gender?: 'girl' | 'boy' | 'unisex' | null;
  heightFrom?: number | null;
  heightTo?: number | null;
  sizeLabel?: string | null;
  parts?: unknown;
}

/** Удалённая категория для костюма — всё равно что её нет. */
function toCategoryRef(
  category: CostumeCategoryRow | null | undefined,
): CostumeCategoryRefDto | null {
  if (!category || category.deletedAt) return null;
  return {
    id: category.id,
    name: category.name,
    parentId: category.parentId,
    parentName: category.parent?.name ?? null,
  };
}

/** Поля каталога (категория, пол, рост, размер, состав), общие для всех ответов по костюму. */
export function toCostumeCatalogFields(costume: CostumeCatalogRow) {
  return {
    costumeId: costume.id,
    name: costume.name,
    inventoryCode: costume.inventoryCode,
    category: toCategoryRef(costume.category),
    gender: costume.gender ?? null,
    heightFrom: costume.heightFrom ?? null,
    heightTo: costume.heightTo ?? null,
    sizeLabel: costume.sizeLabel ?? null,
    parts: parseCostumeParts(costume.parts),
  };
}

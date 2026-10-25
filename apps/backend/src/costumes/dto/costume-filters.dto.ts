import { z } from 'zod';
import { CostumeGenderSchema } from '@costumes/shared';
import { createZodDto } from '../../common/zod-dto';

const optionalInt = (min: number, max?: number) =>
  z.preprocess(
    (value) =>
      value === '' || value === undefined ? undefined : Number(value),
    max === undefined
      ? z.number().int().min(min).optional()
      : z.number().int().min(min).max(max).optional(),
  );

/** Query-параметры каталога в `/costumes/list`, `/costumes/search`, `/costumes/search-available`. */
export const CostumeFiltersQuerySchema = z.object({
  categoryId: optionalInt(1),
  gender: CostumeGenderSchema.optional(),
  height: optionalInt(50, 200),
  withoutCategory: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

export class CostumeFiltersQuery extends createZodDto(
  CostumeFiltersQuerySchema,
) {}

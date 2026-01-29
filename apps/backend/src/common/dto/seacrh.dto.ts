// src/common/dto/search.schema.ts
import { z } from 'zod';
import { createZodDto } from '../zod-dto';

export const SearchSchema = z.object({
  q: z.string().min(2, 'Минимальная длина поиска — 2 символа'),
});

export class SearchSchemaDto extends createZodDto(SearchSchema) {}
export type SearchDto = z.infer<typeof SearchSchema>;

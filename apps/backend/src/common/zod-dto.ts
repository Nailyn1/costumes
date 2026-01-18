import { z } from 'zod';

export class ZodDto<T extends z.ZodTypeAny = z.ZodTypeAny> {
  static schema: z.ZodType;
  constructor(public readonly data: z.infer<T>) {}
}

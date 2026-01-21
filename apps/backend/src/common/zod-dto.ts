import { z } from 'zod';

export class ZodDto {
  // Статическое поле для хранения схемы
  static schema: z.ZodSchema;

  // Этот конструктор и типизация заставят TS думать,
  // что класс обладает полями из схемы
  constructor() {}
}

// Утилита для создания DTO классов на лету
export const createZodDto = <T extends z.ZodSchema>(schema: T) => {
  class GeneratedDto {
    static schema = schema;
  }
  // Типизируем как пересечение класса и инфер-типа схемы
  return GeneratedDto as unknown as {
    new (): z.infer<T>;
    schema: T;
  };
};

import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

class ExampleDto {
  static schema = z.object({ name: z.string() });
}

describe('ZodValidationPipe', () => {
  it('includes statusCode in the validation error response', () => {
    const pipe = new ZodValidationPipe();

    try {
      pipe.transform({ name: 1 }, { type: 'body', metatype: ExampleDto });
      throw new Error('Expected validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as Record<
        string,
        unknown
      >;
      expect(response).toMatchObject({
        statusCode: 400,
        message: 'Проверьте введённые данные',
        code: 'VALIDATION_ERROR',
        fieldErrors: { name: ['Укажите значение в правильном формате'] },
      });
      expect(response.errors).toBeUndefined();
    }
  });
});

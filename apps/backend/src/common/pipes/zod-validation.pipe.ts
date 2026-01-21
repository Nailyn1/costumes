import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { z } from 'zod';

interface ZodMetatype {
  schema: z.ZodTypeAny;
}

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata) {
    const metatype = metadata.metatype;

    // Если схемы нет, возвращаем данные как есть
    if (!this.hasSchema(metatype)) {
      return value;
    }

    const result = metatype.schema.safeParse(value);

    if (!result.success) {
      // Используем flatten или формат ошибок, который вам удобен
      throw new BadRequestException({
        message: 'Validation failed',
        errors: result.error.format(),
      });
    }

    // Возвращаем чистый провалидированный объект
    return result.data;
  }

  private hasSchema(metatype: unknown): metatype is ZodMetatype {
    return (
      typeof metatype === 'function' &&
      metatype !== null &&
      'schema' in metatype &&
      (metatype as ZodMetatype).schema instanceof z.ZodType
    );
  }
}

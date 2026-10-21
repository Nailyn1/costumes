import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  HttpStatus,
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
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const path = issue.path.length ? issue.path.join('.') : '_root';
        (fieldErrors[path] ??= []).push(this.messageForIssue(issue));
      }
      throw new BadRequestException({
        message: 'Проверьте введённые данные',
        statusCode: HttpStatus.BAD_REQUEST,
        code: 'VALIDATION_ERROR',
        fieldErrors,
      });
    }

    // Возвращаем чистый провалидированный объект
    return result.data;
  }

  private messageForIssue(issue: z.core.$ZodIssue): string {
    switch (issue.code) {
      case 'invalid_type':
        return 'Укажите значение в правильном формате';
      case 'too_small':
        return 'Значение слишком короткое или маленькое';
      case 'too_big':
        return 'Значение слишком длинное или большое';
      case 'invalid_format':
        return 'Проверьте формат значения';
      case 'invalid_value':
        return 'Выберите допустимое значение';
      default:
        return 'Проверьте значение';
    }
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

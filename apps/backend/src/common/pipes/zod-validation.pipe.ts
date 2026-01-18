import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { z } from 'zod';

interface MetatypeWithSchema {
  schema: z.ZodTypeAny;
}

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata) {
    const metatype = metadata.metatype;

    if (!this.hasSchema(metatype)) {
      return value;
    }

    const result = metatype.schema.safeParse(value);

    if (!result.success) {
      const treeifiedErrors = z.treeifyError(result.error);

      throw new BadRequestException({
        message: 'Validation failed',
        errors: treeifiedErrors,
      });
    }

    return result.data;
  }

  private hasSchema(metatype: unknown): metatype is MetatypeWithSchema {
    return (
      typeof metatype === 'function' &&
      'schema' in metatype &&
      metatype.schema instanceof z.ZodType
    );
  }
}

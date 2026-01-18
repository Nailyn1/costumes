import {
  LoginRequestSchema,
  LoginResponseSchema,
  RefreshResponseSchema,
} from '@project/shared';
import { ZodDto } from 'src/common/zod-dto';
import { z } from 'zod';

export class LoginDto extends ZodDto<typeof LoginRequestSchema> {
  static override schema = LoginRequestSchema as z.ZodType;
}

export class RefreshTokenDto extends ZodDto<typeof RefreshResponseSchema> {
  static override schema = RefreshResponseSchema as z.ZodType;
}

export class LoginResponseDto extends ZodDto<typeof LoginResponseSchema> {
  static override schema = LoginResponseSchema as z.ZodType;
}

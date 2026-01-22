import {
  LoginRequestSchema,
  LoginResponseSchema,
  RefreshResponseSchema,
} from '@costumes/shared';
import { createZodDto } from '../../common/zod-dto';

export class LoginDto extends createZodDto(LoginRequestSchema) {}

export class RefreshTokenResponseDto extends createZodDto(
  RefreshResponseSchema,
) {}

export class LoginResponseDto extends createZodDto(LoginResponseSchema) {}

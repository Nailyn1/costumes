import {
  CreateChildRequestSchema,
  UpdateChildRequestSchema,
  CreateChildResponseSchema,
  UpdateChildResponseSchema,
} from '@costumes/shared';
import { createZodDto } from '../../common/zod-dto';

export class CreateChildRequest extends createZodDto(
  CreateChildRequestSchema,
) {}
export class CreateChildResponse extends createZodDto(
  CreateChildResponseSchema,
) {}

export class UpdateChildRequest extends createZodDto(
  UpdateChildRequestSchema,
) {}
export class UpdateChildResponse extends createZodDto(
  UpdateChildResponseSchema,
) {}

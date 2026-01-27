import {
  CreateChildRequestSchema,
  UpdateChildRequestSchema,
  CreateChildResponseSchema,
  UpdateChildResponseSchema,
  CreateClientRequestSchema,
  CreateClientResponseSchema,
  UpdateClientRequestSchema,
  UpdateClientResponseSchema,
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

export class CreateClientRequest extends createZodDto(
  CreateClientRequestSchema,
) {}
export class CreateClientResponse extends createZodDto(
  CreateClientResponseSchema,
) {}

export class UpdateClientRequest extends createZodDto(
  UpdateClientRequestSchema,
) {}
export class UpdateClientResponse extends createZodDto(
  UpdateClientResponseSchema,
) {}

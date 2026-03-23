import {
  CostumesAvailabilityResponseSchema,
  CostumesSearchAvailableResponseSchema,
  CostumesSearchResponseSchema,
  CreateCostumesRequestSchema,
  CreateUpdateCostumesResponseSchema,
  UpdateCostumesRequestSchema,
} from '@costumes/shared';
import { createZodDto } from '../../common/zod-dto';

export class CreateCostumesRequest extends createZodDto(
  CreateCostumesRequestSchema,
) {}
export class CreateCostumesResponse extends createZodDto(
  CreateUpdateCostumesResponseSchema,
) {}
export class UpdateCostumesRequest extends createZodDto(
  UpdateCostumesRequestSchema,
) {}
export class CostumesSearchResponse extends createZodDto(
  CostumesSearchResponseSchema,
) {}
export class CostumesSearchAvailableResponse extends createZodDto(
  CostumesSearchAvailableResponseSchema,
) {}
export class CostumesAvailabilityResponse extends createZodDto(
  CostumesAvailabilityResponseSchema,
) {}

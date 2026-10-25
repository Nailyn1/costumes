import {
  CreateCostumeCategoryRequestSchema,
  UpdateCostumeCategoryRequestSchema,
} from '@costumes/shared';
import { createZodDto } from '../../common/zod-dto';

export class CreateCostumeCategoryRequest extends createZodDto(
  CreateCostumeCategoryRequestSchema,
) {}
export class UpdateCostumeCategoryRequest extends createZodDto(
  UpdateCostumeCategoryRequestSchema,
) {}

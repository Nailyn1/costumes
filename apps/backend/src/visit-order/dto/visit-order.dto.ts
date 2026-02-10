import {
  CreateVisitRequestSchema,
  CreateVisitResponseSchema,
  OrdersNotWrittenResponseSchema,
} from '@costumes/shared';
import { createZodDto } from '../../common/zod-dto';

export class CreateVisitRequest extends createZodDto(
  CreateVisitRequestSchema,
) {}
export class CreateVisitResponse extends createZodDto(
  CreateVisitResponseSchema,
) {}

export class OrdersNotWrittenResponse extends createZodDto(
  OrdersNotWrittenResponseSchema,
) {}

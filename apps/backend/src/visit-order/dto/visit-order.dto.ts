import {
  CreateVisitRequestSchema,
  CreateVisitResponseSchema,
  OrdersNotWrittenResponseSchema,
  VisitIssueRequestSchema,
} from '@costumes/shared';
import { createZodDto } from '../../common/zod-dto';
import { z } from 'zod';

export const MarkDepositReturnedSchema = z
  .object({
    notes: z.string().optional(),
  })
  .strict();
export class CreateVisitRequest extends createZodDto(
  CreateVisitRequestSchema,
) {}
export class CreateVisitResponse extends createZodDto(
  CreateVisitResponseSchema,
) {}

export class OrdersNotWrittenResponse extends createZodDto(
  OrdersNotWrittenResponseSchema,
) {}

export class VisitIssueRequest extends createZodDto(VisitIssueRequestSchema) {}
export class MarkDepositReturnedRequest extends createZodDto(
  MarkDepositReturnedSchema,
) {}

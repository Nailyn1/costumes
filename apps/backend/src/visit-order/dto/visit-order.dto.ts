import {
  CreateVisitRequestSchema,
  CreateVisitResponseSchema,
  OrdersNotWrittenResponseSchema,
  VisitCancelRequestSchema,
  VisitCompleteReturnRequestSchema,
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
export class CompleteReturnRequest extends createZodDto(
  VisitCompleteReturnRequestSchema,
) {}

export class VisitCancelRequest extends createZodDto(
  VisitCancelRequestSchema,
) {}

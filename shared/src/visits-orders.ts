import { schemas } from "./openapi-client.js";
import { z } from "zod";

export type CreateVisitRequestDto = z.infer<
  typeof schemas.Visits_CreateVisitRequest
>;
export type CreateVisitResponseDto = z.infer<typeof schemas.Visits_Visit>;

export const CreateVisitRequestSchema = schemas.Visits_CreateVisitRequest;
export const CreateVisitResponseSchema = schemas.Visits_Visit;
export const VisitCompleteReturnRequestSchema =
  schemas.Visits_CompleteReturnRequest;
export const VisitCancelRequestSchema = schemas.Visits_VisitCancelRequest;

export type OrdersNotWrittenResponseDto = z.infer<
  typeof schemas.Visits_NotWrittenOrdersResponse
>;
export const OrdersNotWrittenResponseSchema =
  schemas.Visits_NotWrittenOrdersResponse;

export type IssuedForReturnDto = z.infer<
  typeof schemas.Visits_IssuedForReturnResponse
>;

export type VisitIssueRequestDto = z.infer<
  typeof schemas.Visits_IssueVisitRequest
>;
export const VisitIssueRequestSchema = schemas.Visits_IssueVisitRequest;

export type GetVisitReservedDto = z.infer<
  typeof schemas.Visits_PaginatedReservedResponse
>;

export type GetVisitSearchDto = z.infer<
  typeof schemas.Visits_VisitsSearchResponse
>;

export type GetVisitForIssueDto = z.infer<
  typeof schemas.Visits_VisitForIssueResponse
>;

export type GetVisitReturnSearchDto = z.infer<
  typeof schemas.Visits_VisitReturnSearchResponse
>;

export type GetVisitsForReturnDto = z.infer<
  typeof schemas.Visits_VisitForReturnResponse
>;

export type MarkDepositReturnedDto = z.infer<
  typeof schemas.Visits_MarkDepositReturnedResponse
>;

export type visitCompleteReturnResponseDto = z.infer<
  typeof schemas.Visits_CompleteReturnResponse
>;

export type visitCompleteReturnRequestDto = z.infer<
  typeof schemas.Visits_CompleteReturnRequest
>;

export type visitCancelRequestDto = z.infer<
  typeof schemas.Visits_VisitCancelRequest
>;

export type visitUnreturnedDepositsResponseDto = z.infer<
  typeof schemas.Visits_GetUnreturnedDepositsResponse
>;

export type visitIssuedRepsonseDto = z.infer<
  typeof schemas.Visits_GetIssuedResponse
>;

export type searchNotificationDto = z.infer<
  typeof schemas.Visits_NotificationItem
>;

export type visitNotificationResponseDto = z.infer<
  typeof schemas.Visits_GetNotificationResponse
>;

import { schemas } from "./schemas.js";
import type {
  get_VisitOperation_getHistory,
  get_VisitOperation_list,
  patch_VisitOperation_updateReserved,
  post_VisitOperation_addAndIssue,
} from "./openapi-client.js";
import { z } from "zod";

export type CreateVisitRequestDto = z.infer<
  typeof schemas.Visits_CreateVisitRequest
>;
export type QuickIssueVisitRequestDto = z.infer<
  typeof schemas.Visits_QuickIssueVisitRequest
>;
export const QuickIssueVisitRequestSchema =
  schemas.Visits_QuickIssueVisitRequest;
export type QuickIssueVisitResponseDto = z.infer<
  typeof schemas.Visits_QuickIssueVisitResponse
>;
export const QuickIssueVisitResponseSchema =
  schemas.Visits_QuickIssueVisitResponse;
export type CreateVisitResponseDto = z.infer<typeof schemas.Visits_Visit>;
export type PreviewVisitCodeResponseDto = z.infer<
  typeof schemas.Costumes_VisitCode
>;

export const CreateVisitRequestSchema = schemas.Visits_CreateVisitRequest;
export const CreateVisitResponseSchema = schemas.Visits_Visit;
export const PreviewVisitCodeResponseSchema = schemas.Costumes_VisitCode;
export const VisitCompleteReturnRequestSchema =
  schemas.Visits_CompleteReturnRequest;
export type VisitBalanceDto = z.infer<typeof schemas.Visits_VisitBalance>;
export const VisitBalanceSchema = schemas.Visits_VisitBalance;
export type VisitSettlementRequestDto = z.infer<
  typeof schemas.Visits_VisitSettlementRequest
>;
export const VisitSettlementRequestSchema =
  schemas.Visits_VisitSettlementRequest;
export type VisitHistoryEventDto = z.infer<
  typeof schemas.Visits_VisitHistoryEvent
>;
export const VisitHistoryEventSchema = schemas.Visits_VisitHistoryEvent;
export type VisitHistoryPayloadDto = z.infer<
  typeof schemas.Visits_VisitHistoryPayload
>;
export const VisitHistoryPayloadSchema = schemas.Visits_VisitHistoryPayload;
export type PaginatedVisitHistoryResponseDto = z.infer<
  typeof schemas.Visits_PaginatedVisitHistoryResponse
>;
export const PaginatedVisitHistoryResponseSchema =
  schemas.Visits_PaginatedVisitHistoryResponse;
export type PaginatedVisitsResponseDto = z.infer<
  typeof schemas.Visits_PaginatedVisitsResponse
>;
export const PaginatedVisitsResponseSchema =
  schemas.Visits_PaginatedVisitsResponse;
export type VisitReadDetailDto = z.infer<typeof schemas.Visits_VisitReadDetail>;
export const VisitReadDetailSchema = schemas.Visits_VisitReadDetail;
export type UpdateReservedVisitOrderDto = z.infer<
  typeof schemas.Visits_UpdateReservedVisitOrder
>;
export type UpdateReservedVisitRequestDto = z.infer<
  typeof schemas.Visits_UpdateReservedVisitRequest
>;
export const UpdateReservedVisitRequestSchema =
  schemas.Visits_UpdateReservedVisitRequest;
export type UpdateReservedVisitResponseDto = VisitReadDetailDto;
export const UpdateReservedVisitResponseSchema = VisitReadDetailSchema;
export type AddAndIssueVisitOrderDto = z.infer<
  typeof schemas.Visits_AddAndIssueVisitRequestOrder
>;
export type AddAndIssueVisitRequestDto = z.infer<
  typeof schemas.Visits_AddAndIssueVisitRequest
>;
export const AddAndIssueVisitRequestSchema =
  schemas.Visits_AddAndIssueVisitRequest;
export type AddAndIssueVisitResponseDto = VisitReadDetailDto;
export const AddAndIssueVisitResponseSchema = VisitReadDetailSchema;
export type AddAndIssueVisitPathDto = NonNullable<
  post_VisitOperation_addAndIssue["parameters"]["path"]
>;
export type UpdateReservedVisitPathDto = NonNullable<
  patch_VisitOperation_updateReserved["parameters"]["path"]
>;
export type VisitListQueryDto = NonNullable<
  get_VisitOperation_list["parameters"]["query"]
>;
export type VisitHistoryQueryDto = NonNullable<
  get_VisitOperation_getHistory["parameters"]["query"]
>;
export type PaginatedUnsettledVisitBalancesResponseDto = z.infer<
  typeof schemas.Visits_PaginatedUnsettledVisitBalancesResponse
>;
export const PaginatedUnsettledVisitBalancesResponseSchema =
  schemas.Visits_PaginatedUnsettledVisitBalancesResponse;
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

export type visitIssuedResponseDto = z.infer<
  typeof schemas.Visits_GetIssuedResponse
>;

export type searchNotificationDto = z.infer<
  typeof schemas.Visits_NotificationItem
>;

export type visitNotificationResponseDto = z.infer<
  typeof schemas.Visits_GetNotificationResponse
>;

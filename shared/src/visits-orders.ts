import { schemas } from "./openapi-client.js";
import { z } from "zod";

export type CreateVisitRequestDto = z.infer<
  typeof schemas.Visits_CreateVisitRequest
>;
export type CreateVisitResponseDto = z.infer<typeof schemas.Visits_Visit>;

export const CreateVisitRequestSchema = schemas.Visits_CreateVisitRequest;
export const CreateVisitResponseSchema = schemas.Visits_Visit;

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
  typeof schemas.Visits_GetReservedResponse
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

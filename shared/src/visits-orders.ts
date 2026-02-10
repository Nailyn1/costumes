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

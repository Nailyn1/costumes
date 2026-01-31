import { schemas } from "./openapi-client.js";
import { z } from "zod";

export type CreateCostumesRequestDto = z.infer<
  typeof schemas.Costumes_CreateCostumeRequest
>;
export type CreateUpdateCostumesResponseDto = z.infer<
  typeof schemas.Costumes_Costume
>;
export type UpdateCostumesRequestDto = z.infer<
  typeof schemas.Costumes_UpdateCostumeRequest
>;
export type CostumesSearchResponseDto = z.infer<
  typeof schemas.Costumes_CostumeSearchResult
>;
export type CostumesSearchAvailableResponseDto = z.infer<
  typeof schemas.Costumes_AvailableCostume
>;
export type CostumesAvailabilityResponseDto = z.infer<
  typeof schemas.Costumes_CostumeFullAvailability
>;

export const CreateCostumesRequestSchema =
  schemas.Costumes_CreateCostumeRequest;
export const CreateUpdateCostumesResponseSchema = schemas.Costumes_Costume;
export const UpdateCostumesRequestSchema =
  schemas.Costumes_UpdateCostumeRequest;
export const CostumesSearchResponseSchema =
  schemas.Costumes_CostumeSearchResult;
export const CostumesSearchAvailableResponseSchema =
  schemas.Costumes_AvailableCostume;
export const CostumesAvailabilityResponseSchema =
  schemas.Costumes_CostumeFullAvailability;

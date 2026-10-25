import { schemas } from "./schemas.js";
import type {
  get_CostumeOperations_getCostumesList,
  get_CostumeOperations_searchAvailability,
  get_CostumeOperations_searchAvailable,
} from "./openapi-client.js";
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
export type CostumesListResponseDto = z.infer<
  typeof schemas.Costumes_GetCostumesList
>;
export type SearchAvailableCostumesQueryDto = NonNullable<
  get_CostumeOperations_searchAvailable["parameters"]["query"]
>;

export type CostumeGenderDto = z.infer<typeof schemas.Costumes_CostumeGender>;
export type CostumesListQueryDto = NonNullable<
  get_CostumeOperations_getCostumesList["parameters"]["query"]
>;
export type SearchCostumesQueryDto = NonNullable<
  get_CostumeOperations_searchAvailability["parameters"]["query"]
>;

export const CostumeGenderSchema = schemas.Costumes_CostumeGender;
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

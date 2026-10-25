import { schemas } from "./schemas.js";
import type {
  get_CostumeOperations_searchAvailable,
  post_CostumePhotoOperations_upload,
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

// Фото костюмов (T-111)
export type CostumePhotoDto = z.infer<typeof schemas.Costumes_CostumePhoto>;
export const CostumePhotoSchema = schemas.Costumes_CostumePhoto;
export type ReorderCostumePhotosRequestDto = z.infer<
  typeof schemas.Costumes_ReorderCostumePhotosRequest
>;
export const ReorderCostumePhotosRequestSchema =
  schemas.Costumes_ReorderCostumePhotosRequest;
/** Текстовые поля multipart-формы загрузки (файлы `image` и `thumb` приходят отдельно). */
export type UploadCostumePhotoFormDto = z.infer<
  typeof schemas.Costumes_UploadCostumePhotoForm
>;
export const UploadCostumePhotoFieldsSchema = z.object({
  width: z.coerce.number().int().min(1).max(10000),
  height: z.coerce.number().int().min(1).max(10000),
});
export type UploadCostumePhotoFieldsDto = z.infer<
  typeof UploadCostumePhotoFieldsSchema
>;
export type UploadCostumePhotoPathDto = NonNullable<
  post_CostumePhotoOperations_upload["parameters"]["path"]
>;

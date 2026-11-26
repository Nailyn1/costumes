import { schemas } from "./schemas.js";
import type {
  get_CostumeOperations_getCostumesList,
  get_CostumeOperations_searchAvailability,
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

export type CostumeCategoryDto = z.infer<
  typeof schemas.Costumes_CostumeCategory
>;
export type CostumeCategoryNodeDto = z.infer<
  typeof schemas.Costumes_CostumeCategoryNode
>;
export type CostumeCategoryRefDto = z.infer<
  typeof schemas.Costumes_CostumeCategoryRef
>;
export type CreateCostumeCategoryRequestDto = z.infer<
  typeof schemas.Costumes_CreateCostumeCategoryRequest
>;
export type UpdateCostumeCategoryRequestDto = z.infer<
  typeof schemas.Costumes_UpdateCostumeCategoryRequest
>;

export const CostumeCategorySchema = schemas.Costumes_CostumeCategory;
export const CostumeCategoryNodeSchema =
  schemas.Costumes_CostumeCategoryNode;
export const CreateCostumeCategoryRequestSchema =
  schemas.Costumes_CreateCostumeCategoryRequest;
export const UpdateCostumeCategoryRequestSchema =
  schemas.Costumes_UpdateCostumeCategoryRequest;

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

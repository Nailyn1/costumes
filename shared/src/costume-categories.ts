import { schemas } from "./schemas.js";
import { z } from "zod";

export type CostumeCategoryDto = z.infer<
  typeof schemas.CostumeCategories_CostumeCategory
>;
export type CostumeCategoryNodeDto = z.infer<
  typeof schemas.CostumeCategories_CostumeCategoryNode
>;
export type CostumeCategoryRefDto = z.infer<
  typeof schemas.CostumeCategories_CostumeCategoryRef
>;
export type CreateCostumeCategoryRequestDto = z.infer<
  typeof schemas.CostumeCategories_CreateCostumeCategoryRequest
>;
export type UpdateCostumeCategoryRequestDto = z.infer<
  typeof schemas.CostumeCategories_UpdateCostumeCategoryRequest
>;

export const CostumeCategorySchema = schemas.CostumeCategories_CostumeCategory;
export const CostumeCategoryNodeSchema =
  schemas.CostumeCategories_CostumeCategoryNode;
export const CreateCostumeCategoryRequestSchema =
  schemas.CostumeCategories_CreateCostumeCategoryRequest;
export const UpdateCostumeCategoryRequestSchema =
  schemas.CostumeCategories_UpdateCostumeCategoryRequest;

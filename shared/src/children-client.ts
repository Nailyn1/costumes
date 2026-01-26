import { schemas } from "./openapi-client.js";
import { z } from "zod";

export type CreateChildRequestDto = z.infer<
  typeof schemas.Children_CreateChildRequest
>;
export type CreateChildResponsetDto = z.infer<
  typeof schemas.Children_ChildResponse
>;
export type UpdateChildRequestDto = z.infer<
  typeof schemas.Children_UpdateChildRequest
>;
export type UpdateChildResponseDto = z.infer<
  typeof schemas.Children_ChildUpdateResponse
>;

export const CreateChildRequestSchema = schemas.Children_CreateChildRequest;
export const CreateChildResponseSchema = schemas.Children_ChildResponse;
export const UpdateChildRequestSchema = schemas.Children_UpdateChildRequest;
export const UpdateChildResponseSchema = schemas.Children_ChildUpdateResponse;

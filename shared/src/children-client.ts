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

export type CreateClientRequestDto = z.infer<
  typeof schemas.Clients_CreateClientRequest
>;
export type CreateChildResponseDto = z.infer<typeof schemas.Clients_Client>;
export type UpdateClientRequestDto = z.infer<
  typeof schemas.Clients_UpdateClientRequest
>;
export type UpdateClientResponseDto = z.infer<typeof schemas.Clients_Client>;

export const CreateClientRequestSchema = schemas.Clients_CreateClientRequest;
export const CreateClientResponseSchema = schemas.Clients_Client;
export const UpdateClientRequestSchema = schemas.Clients_UpdateClientRequest;
export const UpdateClientResponseSchema = schemas.Clients_Client;

import { schemas } from "./openapi-client.js";
import { z } from "zod";

export type LoginRequestDto = z.infer<typeof schemas.Auth_LoginRequest>;
export type LoginSuccessResponseDto = z.infer<
  typeof schemas.Auth_LoginSuccessResponse
>;
export type RefreshSuccessResponseDto = z.infer<
  typeof schemas.Auth_RefreshSuccessResponse
>;

export const LoginRequestSchema = schemas.Auth_LoginRequest;
export const LoginResponseSchema = schemas.Auth_LoginSuccessResponse;
export const RefreshResponseSchema = schemas.Auth_RefreshSuccessResponse;

import { makeApi, Zodios, type ZodiosOptions } from "@zodios/core";
import { z } from "zod";

const Auth_LoginRequest = z
  .object({ login: z.string().min(6), password: z.string().min(12) })
  .passthrough();
const Auth_LoginSuccessResponse = z
  .object({
    accessToken: z.string(),
    user: z.object({ login: z.string() }).passthrough(),
  })
  .passthrough();
const Common_Error = z
  .object({ code: z.number().int(), message: z.string() })
  .passthrough();
const Auth_RefreshSuccessResponse = z
  .object({ accessToken: z.string() })
  .passthrough();

export const schemas = {
  Auth_LoginRequest,
  Auth_LoginSuccessResponse,
  Common_Error,
  Auth_RefreshSuccessResponse,
};

const endpoints = makeApi([
  {
    method: "post",
    path: "/auth/login",
    alias: "AuthOperations_login",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: Auth_LoginRequest,
      },
    ],
    response: Auth_LoginSuccessResponse,
  },
  {
    method: "post",
    path: "/auth/logout",
    alias: "AuthOperations_logout",
    requestFormat: "json",
    response: z.void(),
  },
  {
    method: "post",
    path: "/auth/refresh",
    alias: "AuthOperations_refresh",
    requestFormat: "json",
    parameters: [
      {
        name: "Cookie",
        type: "Header",
        schema: z.string(),
      },
    ],
    response: z.object({ accessToken: z.string() }).passthrough(),
  },
]);

export const api = new Zodios(endpoints);

export function createApiClient(baseUrl: string, options?: ZodiosOptions) {
  return new Zodios(baseUrl, endpoints, options);
}

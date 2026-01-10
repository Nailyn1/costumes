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
const Clients_ClientName = z.string();
const Clients_PhoneString = z.string();
const Clients_CreateClientRequest = z
  .object({
    name: Clients_ClientName.min(2).regex(
      /^[a-zA-Zа-яА-ЯёЁәіңғүұқөһӘІҢҒҮҰҚӨҺ\s-]+$/
    ),
    phone: Clients_PhoneString.regex(/^\+7\d{10}$/),
  })
  .passthrough();
const Clients_Client = z
  .object({
    clientId: z.number().int(),
    name: Clients_ClientName.min(2).regex(
      /^[a-zA-Zа-яА-ЯёЁәіңғүұқөһӘІҢҒҮҰҚӨҺ\s-]+$/
    ),
    phone: Clients_PhoneString.regex(/^\+7\d{10}$/),
    children: z.array(z.string()).optional(),
  })
  .passthrough();
const Clients_UpdateClientRequest = z
  .object({
    name: Clients_ClientName.min(2).regex(
      /^[a-zA-Zа-яА-ЯёЁәіңғүұқөһӘІҢҒҮҰҚӨҺ\s-]+$/
    ),
    phone: Clients_PhoneString.regex(/^\+7\d{10}$/),
  })
  .partial()
  .passthrough();

export const schemas = {
  Auth_LoginRequest,
  Auth_LoginSuccessResponse,
  Common_Error,
  Auth_RefreshSuccessResponse,
  Clients_ClientName,
  Clients_PhoneString,
  Clients_CreateClientRequest,
  Clients_Client,
  Clients_UpdateClientRequest,
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
  {
    method: "post",
    path: "/clients",
    alias: "ClientOperations_create",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: Clients_CreateClientRequest,
      },
    ],
    response: Clients_Client,
  },
  {
    method: "patch",
    path: "/clients/:clientId",
    alias: "ClientOperations_update",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: Clients_UpdateClientRequest,
      },
      {
        name: "clientId",
        type: "Path",
        schema: z.number().int(),
      },
    ],
    response: Clients_Client,
  },
  {
    method: "get",
    path: "/clients/search",
    alias: "ClientOperations_search",
    requestFormat: "json",
    parameters: [
      {
        name: "q",
        type: "Query",
        schema: z.string().min(2),
      },
    ],
    response: z.array(Clients_Client),
  },
]);

export const api = new Zodios(endpoints);

export function createApiClient(baseUrl: string, options?: ZodiosOptions) {
  return new Zodios(baseUrl, endpoints, options);
}

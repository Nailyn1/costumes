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
const Children_ChildName = z.string();
const Children_CreateChildRequest = z
  .object({
    clientId: z.number().int(),
    name: Children_ChildName.min(2).regex(
      /^[a-zA-Zа-яА-ЯёЁәіңғүұқөһӘІҢҒҮҰҚӨҺ\s-]+$/
    ),
  })
  .passthrough();
const Children_Child = z
  .object({
    childId: z.number().int(),
    name: Children_ChildName.min(2).regex(
      /^[a-zA-Zа-яА-ЯёЁәіңғүұқөһӘІҢҒҮҰҚӨҺ\s-]+$/
    ),
    clientId: z.number().int(),
  })
  .passthrough();
const Children_UpdateChildRequest = z
  .object({
    name: Children_ChildName.min(2).regex(
      /^[a-zA-Zа-яА-ЯёЁәіңғүұқөһӘІҢҒҮҰҚӨҺ\s-]+$/
    ),
  })
  .partial()
  .passthrough();
const Children_ChildUpdateResponse = z
  .object({
    childId: z.number().int(),
    name: Children_ChildName.min(2).regex(
      /^[a-zA-Zа-яА-ЯёЁәіңғүұқөһӘІҢҒҮҰҚӨҺ\s-]+$/
    ),
  })
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
const Costumes_CreateCostumeRequest = z
  .object({ name: z.string().min(2) })
  .passthrough();
const Costumes_InventoryCode = z.string();
const Costumes_Costume = z
  .object({
    costumeId: z.number().int(),
    name: z.string(),
    inventoryCode: Costumes_InventoryCode.regex(/^C-\d{4}$/),
  })
  .passthrough();
const Costumes_CostumeSearchResult = Costumes_Costume;
const Costumes_AvailableCostume = Costumes_Costume;
const Costumes_UpdateCostumeRequest = z
  .object({ name: z.string().min(2) })
  .partial()
  .passthrough();
const Costumes_CostumeFullAvailability = Costumes_Costume;

export const schemas = {
  Auth_LoginRequest,
  Auth_LoginSuccessResponse,
  Common_Error,
  Auth_RefreshSuccessResponse,
  Children_ChildName,
  Children_CreateChildRequest,
  Children_Child,
  Children_UpdateChildRequest,
  Children_ChildUpdateResponse,
  Clients_ClientName,
  Clients_PhoneString,
  Clients_CreateClientRequest,
  Clients_Client,
  Clients_UpdateClientRequest,
  Costumes_CreateCostumeRequest,
  Costumes_InventoryCode,
  Costumes_Costume,
  Costumes_CostumeSearchResult,
  Costumes_AvailableCostume,
  Costumes_UpdateCostumeRequest,
  Costumes_CostumeFullAvailability,
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
    path: "/children",
    alias: "ChildOperations_create",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: Children_CreateChildRequest,
      },
    ],
    response: Children_Child,
  },
  {
    method: "patch",
    path: "/children/:childId",
    alias: "ChildOperations_update",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: Children_UpdateChildRequest,
      },
      {
        name: "childId",
        type: "Path",
        schema: z.number().int(),
      },
    ],
    response: Children_ChildUpdateResponse,
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
  {
    method: "post",
    path: "/costumes",
    alias: "CostumeOperations_create",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: z.object({ name: z.string().min(2) }).passthrough(),
      },
    ],
    response: Costumes_Costume,
  },
  {
    method: "patch",
    path: "/costumes/:costumeId",
    alias: "CostumeOperations_update",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: z
          .object({ name: z.string().min(2) })
          .partial()
          .passthrough(),
      },
      {
        name: "costumeId",
        type: "Path",
        schema: z.number().int(),
      },
    ],
    response: Costumes_Costume,
  },
  {
    method: "get",
    path: "/costumes/:costumeId/availability",
    alias: "CostumeOperations_getDetailedAvailability",
    requestFormat: "json",
    parameters: [
      {
        name: "costumeId",
        type: "Path",
        schema: z.number().int(),
      },
    ],
    response: Costumes_CostumeFullAvailability,
  },
  {
    method: "get",
    path: "/costumes/search-availability",
    alias: "CostumeOperations_searchAvailability",
    requestFormat: "json",
    parameters: [
      {
        name: "q",
        type: "Query",
        schema: z.string(),
      },
    ],
    response: z.array(Costumes_CostumeSearchResult),
  },
  {
    method: "get",
    path: "/costumes/search-available",
    alias: "CostumeOperations_searchAvailable",
    requestFormat: "json",
    parameters: [
      {
        name: "q",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "startDate",
        type: "Query",
        schema: z.string(),
      },
      {
        name: "endDate",
        type: "Query",
        schema: z.string(),
      },
    ],
    response: z.array(Costumes_AvailableCostume),
  },
]);

export const api = new Zodios(endpoints);

export function createApiClient(baseUrl: string, options?: ZodiosOptions) {
  return new Zodios(baseUrl, endpoints, options);
}

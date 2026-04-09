import { makeApi, Zodios, type ZodiosOptions } from "@zodios/core";
import { z } from "zod";

const Auth_LoginRequest = z
  .object({ login: z.string().min(6), password: z.string().min(12) })
  .passthrough();
const Auth_LoginSuccessResponse = z
  .object({
    accessToken: z.string(),
    user: z.object({ login: z.string(), name: z.string() }).passthrough(),
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
const Children_ChildResponse = z
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
const Children_Child = z
  .object({ childId: z.number().int(), name: z.string() })
  .passthrough();
const Clients_Client = z
  .object({
    clientId: z.number().int(),
    name: Clients_ClientName.min(2).regex(
      /^[a-zA-Zа-яА-ЯёЁәіңғүұқөһӘІҢҒҮҰҚӨҺ\s-]+$/
    ),
    phone: Clients_PhoneString.regex(/^\+7\d{10}$/),
    children: z.array(Children_Child).optional(),
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
const Costumes_CostumeSearchResult = z
  .object({
    costumeId: z.number().int(),
    name: z.string(),
    inventoryCode: Costumes_InventoryCode.regex(/^C-\d{4}$/),
    display: z.string(),
  })
  .passthrough();
const Costumes_CostumeStatus = z.enum(["available", "issued"]);
const Costumes_AvailableCostume = z
  .object({
    costumeId: z.number().int(),
    name: z.string(),
    inventoryCode: Costumes_InventoryCode.regex(/^C-\d{4}$/),
    status: Costumes_CostumeStatus,
  })
  .passthrough();
const Costumes_UpdateCostumeRequest = z
  .object({ name: z.string().min(2) })
  .partial()
  .passthrough();
const Costumes_VisitCode = z.string();
const Visits_TimeString = z.string();
const Costumes_AvailabilityPeriod = z
  .object({
    visitCode: Costumes_VisitCode.regex(/^\d{4}$/),
    childName: z.string(),
    clientPhone: z.string(),
    startDateTime: z.string(),
    endDateTime: z.string(),
    issueTimeFrom: Visits_TimeString.regex(
      /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/
    ),
    returnTimeUntil: Visits_TimeString.regex(
      /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/
    ),
  })
  .passthrough();
const Costumes_CostumeFullAvailability = z
  .object({
    costumeId: z.number().int(),
    name: z.string(),
    inventoryCode: Costumes_InventoryCode.regex(/^C-\d{4}$/),
    periods: z.array(Costumes_AvailabilityPeriod),
    noPeriodsMessage: z.union([z.string(), z.null()]),
  })
  .passthrough();
const Visits_CreateVisitRequest = z
  .object({
    clientId: z.number().int(),
    visitCode: Costumes_VisitCode.regex(/^\d{4}$/),
    startDateTime: z.string(),
    issueTimeFrom: Visits_TimeString.regex(
      /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/
    ),
    issueTimeTo: Visits_TimeString.regex(/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/),
    endDateTime: z.string(),
    returnTimeUntil: Visits_TimeString.regex(
      /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/
    ),
    notes: z.string().optional(),
    orders: z.array(
      z
        .object({
          childId: z.number().int(),
          costumeId: z.number().int(),
          rentPrice: z.number().int(),
          prepaymentAmount: z.number().int(),
          notes: z.string().optional(),
        })
        .passthrough()
    ),
  })
  .passthrough();
const Visits_VisitStatus = z.enum([
  "reserved",
  "issued",
  "completed",
  "cancelled",
]);
const Visits_Notification = z
  .object({
    id: z.number().int(),
    type: z.string(),
    status: z.enum(["pending", "sent", "delivered", "failed", "read"]),
    createdAt: z.string().datetime({ offset: true }),
  })
  .passthrough();
const Visits_TagStatus = z.enum(["written", "not_written"]);
const Visits_VisitOrder = z
  .object({
    orderId: z.number().int(),
    childName: Children_ChildName.min(2).regex(
      /^[a-zA-Zа-яА-ЯёЁәіңғүұқөһӘІҢҒҮҰҚӨҺ\s-]+$/
    ),
    costumeName: z.string(),
    inventoryCode: Costumes_InventoryCode.regex(/^C-\d{4}$/),
    rentPrice: z.number().int(),
    prepaymentAmount: z.number().int(),
    tagStatus: Visits_TagStatus,
  })
  .passthrough();
const Visits_Visit = z
  .object({
    id: z.number().int(),
    visitCode: Costumes_VisitCode.regex(/^\d{4}$/),
    status: Visits_VisitStatus,
    client: z
      .object({
        id: z.number().int(),
        fullname: Clients_ClientName.min(2).regex(
          /^[a-zA-Zа-яА-ЯёЁәіңғүұқөһӘІҢҒҮҰҚӨҺ\s-]+$/
        ),
        phone: Clients_PhoneString.regex(/^\+7\d{10}$/),
      })
      .passthrough(),
    visitDate: z
      .object({
        startDateTime: z.string(),
        endDateTime: z.string(),
        issueTimeFrom: Visits_TimeString.regex(
          /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/
        ),
        issueTimeTo: Visits_TimeString.regex(
          /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/
        ),
        returnTimeUntil: Visits_TimeString.regex(
          /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/
        ),
      })
      .passthrough(),
    notifications: z.array(Visits_Notification),
    orders: z.array(Visits_VisitOrder),
  })
  .passthrough();
const Visits_GetIssuedItem = z
  .object({
    visitId: z.number().int(),
    visitCode: Costumes_VisitCode.regex(/^\d{4}$/),
    clientName: Clients_ClientName.min(2).regex(
      /^[a-zA-Zа-яА-ЯёЁәіңғүұқөһӘІҢҒҮҰҚӨҺ\s-]+$/
    ),
    clientPhone: Clients_PhoneString.regex(/^\+7\d{10}$/),
    startDateTime: z.string(),
    endDateTime: z.string(),
    childrenNames: z.string(),
    costumesNames: z.string(),
  })
  .passthrough();
const Visits_GetIssuedResponse = z
  .object({
    items: z.array(Visits_GetIssuedItem),
    total: z.number().int(),
    page: z.number().int(),
    limit: z.number().int(),
    hasMore: z.boolean(),
  })
  .passthrough();
const Visits_IssuedForReturnResponse = z
  .object({
    visitId: z.number().int(),
    visitCode: Costumes_VisitCode.regex(/^\d{4}$/),
    clientName: Clients_ClientName.min(2).regex(
      /^[a-zA-Zа-яА-ЯёЁәіңғүұқөһӘІҢҒҮҰҚӨҺ\s-]+$/
    ),
    childrenNames: z.string(),
    costumeNames: z.string(),
    endDateTime: z.string(),
    clientPhone: Clients_PhoneString.regex(/^\+7\d{10}$/),
    notes: z.string(),
  })
  .passthrough();
const Visits_Order = z
  .object({
    orderId: z.number().int(),
    inventoryCode: Costumes_InventoryCode.regex(/^C-\d{4}$/),
    costumeName: z.string(),
    visitCode: Costumes_VisitCode.regex(/^\d{4}$/),
    childName: Children_ChildName.min(2).regex(
      /^[a-zA-Zа-яА-ЯёЁәіңғүұқөһӘІҢҒҮҰҚӨҺ\s-]+$/
    ),
    clientPhone: Clients_PhoneString.regex(/^\+7\d{10}$/),
    startDateTime: z.string(),
    endDateTime: z.string(),
    issueTimeFrom: Visits_TimeString.regex(
      /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/
    ),
    issueTimeTo: Visits_TimeString.regex(/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/),
    returnTimeUntil: Visits_TimeString.regex(
      /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/
    ),
    rentPrice: z.number().int(),
    prepaymentAmount: z.number().int(),
    notes: z.string(),
  })
  .passthrough();
const Visits_NotWrittenOrdersResponse = z
  .object({ items: z.array(Visits_Order), message: z.string().optional() })
  .passthrough();
const Visits_NotificationItem = z
  .object({
    notificationId: z.number().int(),
    status: z.enum([
      "pending",
      "sent",
      "delivered",
      "failed",
      "isConfirmed",
      "read",
      "noAccount",
    ]),
    visitCode: Costumes_VisitCode.regex(/^\d{4}$/),
    clientName: Clients_ClientName.min(2).regex(
      /^[a-zA-Zа-яА-ЯёЁәіңғүұқөһӘІҢҒҮҰҚӨҺ\s-]+$/
    ),
    clientPhone: Clients_PhoneString.regex(/^\+7\d{10}$/),
    childrenNames: z.string(),
    costumeNames: z.string(),
  })
  .passthrough();
const Visits_GetNotificationResponse = z
  .object({
    items: z.array(Visits_NotificationItem),
    totalToday: z.number().int(),
    total: z.number().int(),
    page: z.number().int(),
    limit: z.number().int(),
    hasMore: z.boolean(),
  })
  .passthrough();
const Visits_GetReservedResponse = z
  .object({
    visitId: z.number().int(),
    visitCode: Costumes_VisitCode.regex(/^\d{4}$/),
    clientName: Clients_ClientName.min(2).regex(
      /^[a-zA-Zа-яА-ЯёЁәіңғүұқөһӘІҢҒҮҰҚӨҺ\s-]+$/
    ),
    childrenNames: z.string(),
    costumesNames: z.string(),
    clientPhone: Clients_PhoneString.regex(/^\+7\d{10}$/),
  })
  .passthrough();
const Visits_PaginatedReservedResponse = z
  .object({
    items: z.array(Visits_GetReservedResponse),
    total: z.number().int(),
    page: z.number().int(),
    limit: z.number().int(),
    hasMore: z.boolean(),
  })
  .passthrough();
const Visits_VisitReturnSearchResponse = z
  .object({
    visitId: z.number().int(),
    visitCode: Costumes_VisitCode.regex(/^\d{4}$/),
    childrenNames: z.string(),
    costumesNames: z.string(),
    returnDate: z.string(),
    clientPhone: Clients_PhoneString.regex(/^\+7\d{10}$/),
    clientName: Clients_ClientName.min(2).regex(
      /^[a-zA-Zа-яА-ЯёЁәіңғүұқөһӘІҢҒҮҰҚӨҺ\s-]+$/
    ),
  })
  .passthrough();
const Visits_VisitsSearchResponse = z
  .object({
    visitId: z.number().int(),
    visitCode: Costumes_VisitCode.regex(/^\d{4}$/),
    clientName: Clients_ClientName.min(2).regex(
      /^[a-zA-Zа-яА-ЯёЁәіңғүұқөһӘІҢҒҮҰҚӨҺ\s-]+$/
    ),
    clientPhone: Clients_PhoneString.regex(/^\+7\d{10}$/),
    startDateTime: z.string(),
    childrenNames: z.string(),
    costumesNames: z.string(),
  })
  .passthrough();
const Visits_DepositType = z.enum(["cash", "document", "none"]);
const Visits_VisitDepositInfo = z
  .object({ type: Visits_DepositType, amount: z.number().int().optional() })
  .passthrough();
const Visits_GetUnreturnedResponse = z
  .object({
    visitId: z.number().int(),
    visitCode: Costumes_VisitCode.regex(/^\d{4}$/),
    childrenNames: z.string(),
    costumeNames: z.string(),
    startDateTime: z.string(),
    endDateTime: z.string(),
    clientPhone: Clients_PhoneString.regex(/^\+7\d{10}$/),
    clientName: Clients_ClientName.min(2).regex(
      /^[a-zA-Zа-яА-ЯёЁәіңғүұқөһӘІҢҒҮҰҚӨҺ\s-]+$/
    ),
    deposit: Visits_VisitDepositInfo,
    notes: z.string(),
  })
  .passthrough();
const Visits_GetUnreturnedDepositsResponse = z
  .object({
    items: z.array(Visits_GetUnreturnedResponse),
    total: z.number().int(),
    page: z.number().int(),
    limit: z.number().int(),
    hasMore: z.boolean(),
  })
  .passthrough();
const Visits_VisitCancelRequest = z
  .object({ reason: z.string() })
  .partial()
  .passthrough();
const Visits_CompleteReturnRequest = z
  .object({ depositReturned: z.boolean(), notes: z.string().optional() })
  .passthrough();
const Visits_CompleteReturnResponse = z
  .object({
    visitId: z.number().int(),
    visitCode: Costumes_VisitCode.regex(/^\d{4}$/),
    status: Visits_VisitStatus,
    message: z.string(),
  })
  .passthrough();
const Visits_VisitForIssueResponse = z
  .object({
    visitId: z.number().int(),
    visitCode: Costumes_VisitCode.regex(/^\d{4}$/),
    client: z
      .object({
        name: Clients_ClientName.min(2).regex(
          /^[a-zA-Zа-яА-ЯёЁәіңғүұқөһӘІҢҒҮҰҚӨҺ\s-]+$/
        ),
        phone: Clients_PhoneString.regex(/^\+7\d{10}$/),
      })
      .passthrough(),
    startDateTime: z.string(),
    issueTimeFrom: Visits_TimeString.regex(
      /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/
    ),
    issueTimeTo: Visits_TimeString.regex(/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/),
    returnTimeUntil: Visits_TimeString.regex(
      /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/
    ),
    endDateTime: z.string(),
    totalRentPrice: z.number().int(),
    totalPrepayment: z.number().int(),
    remainingToPay: z.number().int(),
    notes: z.string(),
    orders: z.array(Visits_VisitOrder),
  })
  .passthrough();
const Visits_VisitReturnOrder = z
  .object({
    orderId: z.number().int(),
    childName: Children_ChildName.min(2).regex(
      /^[a-zA-Zа-яА-ЯёЁәіңғүұқөһӘІҢҒҮҰҚӨҺ\s-]+$/
    ),
    costumeName: z.string(),
    inventoryCode: Costumes_InventoryCode.regex(/^C-\d{4}$/),
    rentPrice: z.number().int(),
    prepaymentAmount: z.number().int(),
    finalPayment: z.number().int(),
    returned: z.boolean(),
  })
  .passthrough();
const Visits_VisitForReturnResponse = z
  .object({
    visitId: z.number().int(),
    visitCode: Costumes_VisitCode.regex(/^\d{4}$/),
    client: z
      .object({
        name: Clients_ClientName.min(2).regex(
          /^[a-zA-Zа-яА-ЯёЁәіңғүұқөһӘІҢҒҮҰҚӨҺ\s-]+$/
        ),
        phone: Clients_PhoneString.regex(/^\+7\d{10}$/),
      })
      .passthrough(),
    startDateTime: z.string(),
    endDateTime: z.string(),
    notes: z.string(),
    orders: z.array(Visits_VisitReturnOrder),
    deposit: Visits_VisitDepositInfo,
  })
  .passthrough();
const Visits_IssueVisitRequest = z
  .object({
    additionalPayment: z.number().int(),
    deposit: z
      .object({ type: Visits_DepositType, amount: z.number().int().optional() })
      .passthrough(),
    notes: z.string().optional(),
  })
  .passthrough();
const Visits_MarkDepositReturnedResponse = z
  .object({
    visitId: z.number().int(),
    depositReturned: z.boolean(),
    message: z.string(),
  })
  .passthrough();

export const schemas = {
  Auth_LoginRequest,
  Auth_LoginSuccessResponse,
  Common_Error,
  Auth_RefreshSuccessResponse,
  Children_ChildName,
  Children_CreateChildRequest,
  Children_ChildResponse,
  Children_UpdateChildRequest,
  Children_ChildUpdateResponse,
  Clients_ClientName,
  Clients_PhoneString,
  Clients_CreateClientRequest,
  Children_Child,
  Clients_Client,
  Clients_UpdateClientRequest,
  Costumes_CreateCostumeRequest,
  Costumes_InventoryCode,
  Costumes_Costume,
  Costumes_CostumeSearchResult,
  Costumes_CostumeStatus,
  Costumes_AvailableCostume,
  Costumes_UpdateCostumeRequest,
  Costumes_VisitCode,
  Visits_TimeString,
  Costumes_AvailabilityPeriod,
  Costumes_CostumeFullAvailability,
  Visits_CreateVisitRequest,
  Visits_VisitStatus,
  Visits_Notification,
  Visits_TagStatus,
  Visits_VisitOrder,
  Visits_Visit,
  Visits_GetIssuedItem,
  Visits_GetIssuedResponse,
  Visits_IssuedForReturnResponse,
  Visits_Order,
  Visits_NotWrittenOrdersResponse,
  Visits_NotificationItem,
  Visits_GetNotificationResponse,
  Visits_GetReservedResponse,
  Visits_PaginatedReservedResponse,
  Visits_VisitReturnSearchResponse,
  Visits_VisitsSearchResponse,
  Visits_DepositType,
  Visits_VisitDepositInfo,
  Visits_GetUnreturnedResponse,
  Visits_GetUnreturnedDepositsResponse,
  Visits_VisitCancelRequest,
  Visits_CompleteReturnRequest,
  Visits_CompleteReturnResponse,
  Visits_VisitForIssueResponse,
  Visits_VisitReturnOrder,
  Visits_VisitForReturnResponse,
  Visits_IssueVisitRequest,
  Visits_MarkDepositReturnedResponse,
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
    response: Children_ChildResponse,
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
    method: "delete",
    path: "/children/:childId",
    alias: "ChildOperations_delete",
    requestFormat: "json",
    parameters: [
      {
        name: "childId",
        type: "Path",
        schema: z.number().int(),
      },
    ],
    response: z.void(),
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
    method: "delete",
    path: "/clients/:clientId",
    alias: "ClientOperations_delete",
    requestFormat: "json",
    parameters: [
      {
        name: "clientId",
        type: "Path",
        schema: z.number().int(),
      },
    ],
    response: z.void(),
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
    method: "delete",
    path: "/costumes/:costumeId",
    alias: "CostumeOperations_delete",
    requestFormat: "json",
    parameters: [
      {
        name: "costumeId",
        type: "Path",
        schema: z.number().int(),
      },
    ],
    response: z.void(),
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
    path: "/costumes/search",
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
  {
    method: "post",
    path: "/visits",
    alias: "VisitOperation_create",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: Visits_CreateVisitRequest,
      },
      {
        name: "sendNotification",
        type: "Query",
        schema: z.boolean().optional().default(true),
      },
    ],
    response: Visits_Visit,
  },
  {
    method: "post",
    path: "/visits/:orderId/mark-tag-written",
    alias: "VisitOperation_markTagWritten",
    requestFormat: "json",
    parameters: [
      {
        name: "orderId",
        type: "Path",
        schema: z.number().int(),
      },
    ],
    response: z.void(),
  },
  {
    method: "post",
    path: "/visits/:visitId/cancel",
    alias: "VisitOperation_cancel",
    description: `Отмена визита и всех связанных заказов`,
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        description: `Данные об отмене`,
        type: "Body",
        schema: z.object({ reason: z.string() }).partial().passthrough(),
      },
      {
        name: "visitId",
        type: "Path",
        schema: z.number().int(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `The server could not understand the request due to invalid syntax.`,
        schema: z.object({ body: z.string() }).passthrough(),
      },
      {
        status: 404,
        description: `The server cannot find the requested resource.`,
        schema: z.object({ body: z.string() }).passthrough(),
      },
    ],
  },
  {
    method: "post",
    path: "/visits/:visitId/complete-return",
    alias: "VisitOperation_completeReturn",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: Visits_CompleteReturnRequest,
      },
      {
        name: "visitId",
        type: "Path",
        schema: z.number().int(),
      },
    ],
    response: Visits_CompleteReturnResponse,
  },
  {
    method: "get",
    path: "/visits/:visitId/for-issue",
    alias: "VisitOperation_getForIssue",
    requestFormat: "json",
    parameters: [
      {
        name: "visitId",
        type: "Path",
        schema: z.number().int(),
      },
    ],
    response: Visits_VisitForIssueResponse,
  },
  {
    method: "get",
    path: "/visits/:visitId/for-return",
    alias: "VisitOperation_getForReturn",
    requestFormat: "json",
    parameters: [
      {
        name: "visitId",
        type: "Path",
        schema: z.number().int(),
      },
    ],
    response: Visits_VisitForReturnResponse,
  },
  {
    method: "post",
    path: "/visits/:visitId/issue",
    alias: "VisitOperation_issue",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: Visits_IssueVisitRequest,
      },
      {
        name: "visitId",
        type: "Path",
        schema: z.number().int(),
      },
    ],
    response: z.void(),
  },
  {
    method: "post",
    path: "/visits/:visitId/mark-deposit-returned",
    alias: "VisitOperation_markDepositReturned",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: z.object({ notes: z.string() }).partial().passthrough(),
      },
      {
        name: "visitId",
        type: "Path",
        schema: z.number().int(),
      },
    ],
    response: Visits_MarkDepositReturnedResponse,
  },
  {
    method: "get",
    path: "/visits/issued",
    alias: "VisitOperation_getIssuedVisits",
    requestFormat: "json",
    parameters: [
      {
        name: "page",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "limit",
        type: "Query",
        schema: z.number().int().optional(),
      },
    ],
    response: Visits_GetIssuedResponse,
  },
  {
    method: "get",
    path: "/visits/issued-for-return",
    alias: "VisitOperation_getIssuedForReturn",
    requestFormat: "json",
    response: z.array(Visits_IssuedForReturnResponse),
  },
  {
    method: "get",
    path: "/visits/not_written",
    alias: "VisitOperation_getNotWritten",
    requestFormat: "json",
    response: Visits_NotWrittenOrdersResponse,
  },
  {
    method: "get",
    path: "/visits/notification",
    alias: "VisitOperation_getVisitNotification",
    requestFormat: "json",
    parameters: [
      {
        name: "page",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "limit",
        type: "Query",
        schema: z.number().int().optional(),
      },
    ],
    response: Visits_GetNotificationResponse,
  },
  {
    method: "post",
    path: "/visits/preview-code",
    alias: "VisitOperation_previewCode",
    requestFormat: "json",
    response: z
      .object({ visitCode: Costumes_VisitCode.regex(/^\d{4}$/) })
      .passthrough(),
  },
  {
    method: "get",
    path: "/visits/reserved",
    alias: "VisitOperation_getReserved",
    requestFormat: "json",
    parameters: [
      {
        name: "startDate",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "endDate",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "page",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "limit",
        type: "Query",
        schema: z.number().int().optional(),
      },
    ],
    response: Visits_PaginatedReservedResponse,
  },
  {
    method: "get",
    path: "/visits/return-search",
    alias: "VisitOperation_searchForReturn",
    requestFormat: "json",
    parameters: [
      {
        name: "q",
        type: "Query",
        schema: z.string().min(2),
      },
    ],
    response: z.array(Visits_VisitReturnSearchResponse),
  },
  {
    method: "get",
    path: "/visits/search",
    alias: "VisitOperation_search",
    requestFormat: "json",
    parameters: [
      {
        name: "q",
        type: "Query",
        schema: z.string().min(2),
      },
    ],
    response: z.array(Visits_VisitsSearchResponse),
  },
  {
    method: "get",
    path: "/visits/unreturned-deposits",
    alias: "VisitOperation_getUnreturnedDeposits",
    requestFormat: "json",
    parameters: [
      {
        name: "page",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "limit",
        type: "Query",
        schema: z.number().int().optional(),
      },
    ],
    response: Visits_GetUnreturnedDepositsResponse,
  },
]);

export const api = new Zodios(endpoints);

export function createApiClient(baseUrl: string, options?: ZodiosOptions) {
  return new Zodios(baseUrl, endpoints, options);
}

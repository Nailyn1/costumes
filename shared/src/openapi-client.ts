// @ts-nocheck
import type * as __TypedOpenapi from "./openapi-client.types.js";

import { z } from "zod";

// <Schemas>
export type Auth_LoginRequest = __TypedOpenapi.Schemas.Auth_LoginRequest;
export const Auth_LoginRequest = z
  .object({ login: z.string().min(6), password: z.string().min(12) })
  .catchall(z.unknown());

export type Auth_LoginSuccessResponse = __TypedOpenapi.Schemas.Auth_LoginSuccessResponse;
export const Auth_LoginSuccessResponse = z
  .object({ accessToken: z.string(), user: z.object({ login: z.string(), name: z.string() }).catchall(z.unknown()) })
  .catchall(z.unknown());

export type Auth_RefreshSuccessResponse = __TypedOpenapi.Schemas.Auth_RefreshSuccessResponse;
export const Auth_RefreshSuccessResponse = z.object({ accessToken: z.string() }).catchall(z.unknown());

export type Children_Child = __TypedOpenapi.Schemas.Children_Child;
export const Children_Child = z.object({ childId: z.number().int(), name: z.string() }).catchall(z.unknown());

export type Children_ChildName = __TypedOpenapi.Schemas.Children_ChildName;
export const Children_ChildName = z.string().min(2).regex(new RegExp("^[a-zA-Zа-яА-ЯёЁәіңғүұқөһӘІҢҒҮҰҚӨҺ\\s-]+$"));

export type Children_ChildResponse = __TypedOpenapi.Schemas.Children_ChildResponse;
export const Children_ChildResponse = z
  .object({ childId: z.number().int(), name: Children_ChildName, clientId: z.number().int() })
  .catchall(z.unknown());

export type Children_ChildUpdateResponse = __TypedOpenapi.Schemas.Children_ChildUpdateResponse;
export const Children_ChildUpdateResponse = z
  .object({ childId: z.number().int(), name: Children_ChildName })
  .catchall(z.unknown());

export type Children_CreateChildRequest = __TypedOpenapi.Schemas.Children_CreateChildRequest;
export const Children_CreateChildRequest = z
  .object({ clientId: z.number().int(), name: Children_ChildName })
  .catchall(z.unknown());

export type Children_UpdateChildRequest = __TypedOpenapi.Schemas.Children_UpdateChildRequest;
export const Children_UpdateChildRequest = z.object({ name: Children_ChildName }).partial().catchall(z.unknown());

export type Clients_ClientName = __TypedOpenapi.Schemas.Clients_ClientName;
export const Clients_ClientName = z.string().min(2).regex(new RegExp("^[a-zA-Zа-яА-ЯёЁәіңғүұқөһӘІҢҒҮҰҚӨҺ\\s-]+$"));

export type Clients_PhoneString = __TypedOpenapi.Schemas.Clients_PhoneString;
export const Clients_PhoneString = z.string().regex(new RegExp("^\\+7\\d{10}$"));

export type Clients_Client = __TypedOpenapi.Schemas.Clients_Client;
export const Clients_Client = z
  .object({
    clientId: z.number().int(),
    name: Clients_ClientName,
    phone: Clients_PhoneString,
    children: z.array(Children_Child).optional(),
    isBlacklisted: z.boolean(),
    blacklistReason: z.string().optional(),
  })
  .catchall(z.unknown());

export type Clients_ClientItem = __TypedOpenapi.Schemas.Clients_ClientItem;
export const Clients_ClientItem = z
  .object({
    clientId: z.number().int(),
    name: Clients_ClientName,
    phone: Clients_PhoneString,
    isBlacklisted: z.boolean(),
  })
  .catchall(z.unknown());

export type Visits_OrderStatus = __TypedOpenapi.Schemas.Visits_OrderStatus;
export const Visits_OrderStatus = z.enum(["reserved", "issued", "returned", "cancelled"]);

export type Clients_ClientOrderHistory = __TypedOpenapi.Schemas.Clients_ClientOrderHistory;
export const Clients_ClientOrderHistory = z
  .object({
    orderId: z.number().int(),
    costumeName: z.string(),
    inventoryCode: z.string(),
    childName: z.string(),
    orderStatus: Visits_OrderStatus,
    rentPrice: z.number().int(),
    prepaymentAmount: z.number().int(),
    finalPayment: z.number().int().optional(),
  })
  .catchall(z.unknown());

export type Costumes_VisitCode = __TypedOpenapi.Schemas.Costumes_VisitCode;
export const Costumes_VisitCode = z.string().regex(new RegExp("^\\d{4}$"));

export type Visits_VisitStatus = __TypedOpenapi.Schemas.Visits_VisitStatus;
export const Visits_VisitStatus = z.enum(["reserved", "issued", "completed", "cancelled"]);

export type Visits_TimeString = __TypedOpenapi.Schemas.Visits_TimeString;
export const Visits_TimeString = z.string().regex(new RegExp("^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$"));

export type Clients_ClientVisitHistory = __TypedOpenapi.Schemas.Clients_ClientVisitHistory;
export const Clients_ClientVisitHistory = z
  .object({
    visitId: z.number().int(),
    visitCode: Costumes_VisitCode,
    visitStatus: Visits_VisitStatus,
    createdAt: z.iso.datetime(),
    startDateTime: z.iso.date(),
    endDateTime: z.iso.date(),
    issueTimeFrom: Visits_TimeString,
    returnTimeUntil: Visits_TimeString,
    visitNote: z.string().optional(),
    orders: z.array(Clients_ClientOrderHistory),
  })
  .catchall(z.unknown());

export type Clients_CreateClientRequest = __TypedOpenapi.Schemas.Clients_CreateClientRequest;
export const Clients_CreateClientRequest = z
  .object({ name: Clients_ClientName, phone: Clients_PhoneString })
  .catchall(z.unknown());

export type Clients_GetClientDetailed = __TypedOpenapi.Schemas.Clients_GetClientDetailed;
export const Clients_GetClientDetailed = z
  .object({ client: Clients_Client, visits: z.array(Clients_ClientVisitHistory) })
  .catchall(z.unknown());

export type Clients_GetClientList = __TypedOpenapi.Schemas.Clients_GetClientList;
export const Clients_GetClientList = z
  .object({
    items: z.array(Clients_ClientItem),
    totalOrders: z.number().int(),
    total: z.number().int(),
    page: z.number().int(),
    limit: z.number().int(),
    hasMore: z.boolean(),
  })
  .catchall(z.unknown());

export type Clients_UpdateClientRequest = __TypedOpenapi.Schemas.Clients_UpdateClientRequest;
export const Clients_UpdateClientRequest = z
  .object({ name: Clients_ClientName, phone: Clients_PhoneString })
  .partial()
  .catchall(z.unknown());

export type Clients_blacklistReason = __TypedOpenapi.Schemas.Clients_blacklistReason;
export const Clients_blacklistReason = z.object({ blacklistReason: z.string() }).partial().catchall(z.unknown());

export type Common_Error = __TypedOpenapi.Schemas.Common_Error;
export const Common_Error = z
  .object({ statusCode: z.number().int(), message: z.string(), error: z.string().optional() })
  .catchall(z.unknown());

export type Costumes_AvailabilityPeriod = __TypedOpenapi.Schemas.Costumes_AvailabilityPeriod;
export const Costumes_AvailabilityPeriod = z
  .object({
    visitCode: Costumes_VisitCode,
    clientName: z.string(),
    childName: z.string(),
    clientPhone: z.string(),
    startDateTime: z.iso.date(),
    endDateTime: z.iso.date(),
    issueTimeFrom: Visits_TimeString,
    returnTimeUntil: Visits_TimeString,
  })
  .catchall(z.unknown());

export type Costumes_InventoryCode = __TypedOpenapi.Schemas.Costumes_InventoryCode;
export const Costumes_InventoryCode = z.string().regex(new RegExp("^C-\\d{4}$"));

export type Costumes_CostumeStatus = __TypedOpenapi.Schemas.Costumes_CostumeStatus;
export const Costumes_CostumeStatus = z.enum(["available", "issued"]);

export type Costumes_AvailableCostume = __TypedOpenapi.Schemas.Costumes_AvailableCostume;
export const Costumes_AvailableCostume = z
  .object({
    costumeId: z.number().int(),
    name: z.string(),
    inventoryCode: Costumes_InventoryCode,
    status: Costumes_CostumeStatus,
  })
  .catchall(z.unknown());

export type Costumes_Costume = __TypedOpenapi.Schemas.Costumes_Costume;
export const Costumes_Costume = z
  .object({ costumeId: z.number().int(), name: z.string(), inventoryCode: Costumes_InventoryCode })
  .catchall(z.unknown());

export type Costumes_CostumeFullAvailability = __TypedOpenapi.Schemas.Costumes_CostumeFullAvailability;
export const Costumes_CostumeFullAvailability = z
  .object({
    costumeId: z.number().int(),
    name: z.string(),
    inventoryCode: Costumes_InventoryCode,
    periods: z.array(Costumes_AvailabilityPeriod),
    noPeriodsMessage: z.string().nullable(),
  })
  .catchall(z.unknown());

export type Costumes_CostumeSearchResult = __TypedOpenapi.Schemas.Costumes_CostumeSearchResult;
export const Costumes_CostumeSearchResult = z
  .object({ costumeId: z.number().int(), name: z.string(), inventoryCode: Costumes_InventoryCode, display: z.string() })
  .catchall(z.unknown());

export type Costumes_CreateCostumeRequest = __TypedOpenapi.Schemas.Costumes_CreateCostumeRequest;
export const Costumes_CreateCostumeRequest = z.object({ name: z.string().min(2) }).catchall(z.unknown());

export type Costumes_GetCostumesList = __TypedOpenapi.Schemas.Costumes_GetCostumesList;
export const Costumes_GetCostumesList = z
  .object({
    items: z.array(Costumes_Costume),
    total: z.number().int(),
    page: z.number().int(),
    limit: z.number().int(),
    hasMore: z.boolean(),
  })
  .catchall(z.unknown());

export type Costumes_UpdateCostumeRequest = __TypedOpenapi.Schemas.Costumes_UpdateCostumeRequest;
export const Costumes_UpdateCostumeRequest = z
  .object({ name: z.string().min(2) })
  .partial()
  .catchall(z.unknown());

export type Visits_CompleteReturnRequest = __TypedOpenapi.Schemas.Visits_CompleteReturnRequest;
export const Visits_CompleteReturnRequest = z
  .object({ depositReturned: z.boolean(), notes: z.string().optional() })
  .catchall(z.unknown());

export type Visits_CompleteReturnResponse = __TypedOpenapi.Schemas.Visits_CompleteReturnResponse;
export const Visits_CompleteReturnResponse = z
  .object({ visitId: z.number().int(), visitCode: Costumes_VisitCode, status: Visits_VisitStatus, message: z.string() })
  .catchall(z.unknown());

export type Visits_CreateVisitRequest = __TypedOpenapi.Schemas.Visits_CreateVisitRequest;
export const Visits_CreateVisitRequest = z
  .object({
    clientId: z.number().int(),
    visitCode: Costumes_VisitCode,
    startDateTime: z.iso.date(),
    issueTimeFrom: Visits_TimeString,
    issueTimeTo: Visits_TimeString,
    endDateTime: z.iso.date(),
    returnTimeUntil: Visits_TimeString,
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
        .catchall(z.unknown()),
    ),
  })
  .catchall(z.unknown());

export type Visits_DepositType = __TypedOpenapi.Schemas.Visits_DepositType;
export const Visits_DepositType = z.enum(["cash", "document", "none"]);

export type Visits_VisitDepositInfo = __TypedOpenapi.Schemas.Visits_VisitDepositInfo;
export const Visits_VisitDepositInfo = z
  .object({ type: Visits_DepositType, amount: z.number().int().optional() })
  .catchall(z.unknown());

export type Visits_GetIssuedItem = __TypedOpenapi.Schemas.Visits_GetIssuedItem;
export const Visits_GetIssuedItem = z
  .object({
    visitId: z.number().int(),
    visitCode: Costumes_VisitCode,
    clientName: Clients_ClientName,
    clientPhone: Clients_PhoneString,
    startDateTime: z.iso.date(),
    endDateTime: z.iso.date(),
    childrenNames: z.string(),
    costumesNames: z.string(),
    deposit: Visits_VisitDepositInfo,
  })
  .catchall(z.unknown());

export type Visits_GetIssuedResponse = __TypedOpenapi.Schemas.Visits_GetIssuedResponse;
export const Visits_GetIssuedResponse = z
  .object({
    items: z.array(Visits_GetIssuedItem),
    total: z.number().int(),
    page: z.number().int(),
    limit: z.number().int(),
    hasMore: z.boolean(),
  })
  .catchall(z.unknown());

export type Visits_NotificationItem = __TypedOpenapi.Schemas.Visits_NotificationItem;
export const Visits_NotificationItem = z
  .object({
    notificationId: z.number().int(),
    status: z.enum(["pending", "sent", "delivered", "failed", "isConfirmed", "read", "noAccount"]),
    visitCode: Costumes_VisitCode,
    clientName: Clients_ClientName,
    clientPhone: Clients_PhoneString,
    childrenNames: z.string(),
    costumeNames: z.string(),
    message: z.string(),
  })
  .catchall(z.unknown());

export type Visits_GetNotificationResponse = __TypedOpenapi.Schemas.Visits_GetNotificationResponse;
export const Visits_GetNotificationResponse = z
  .object({
    items: z.array(Visits_NotificationItem),
    totalToday: z.number().int(),
    total: z.number().int(),
    page: z.number().int(),
    limit: z.number().int(),
    hasMore: z.boolean(),
  })
  .catchall(z.unknown());

export type Visits_GetReservedResponse = __TypedOpenapi.Schemas.Visits_GetReservedResponse;
export const Visits_GetReservedResponse = z
  .object({
    visitId: z.number().int(),
    visitCode: Costumes_VisitCode,
    clientName: Clients_ClientName,
    childrenNames: z.string(),
    costumesNames: z.string(),
    clientPhone: Clients_PhoneString,
  })
  .catchall(z.unknown());

export type Visits_GetUnreturnedResponse = __TypedOpenapi.Schemas.Visits_GetUnreturnedResponse;
export const Visits_GetUnreturnedResponse = z
  .object({
    visitId: z.number().int(),
    visitCode: Costumes_VisitCode,
    childrenNames: z.string(),
    costumeNames: z.string(),
    startDateTime: z.iso.date(),
    endDateTime: z.iso.date(),
    clientPhone: Clients_PhoneString,
    clientName: Clients_ClientName,
    deposit: Visits_VisitDepositInfo,
    notes: z.string(),
  })
  .catchall(z.unknown());

export type Visits_GetUnreturnedDepositsResponse = __TypedOpenapi.Schemas.Visits_GetUnreturnedDepositsResponse;
export const Visits_GetUnreturnedDepositsResponse = z
  .object({
    items: z.array(Visits_GetUnreturnedResponse),
    total: z.number().int(),
    page: z.number().int(),
    limit: z.number().int(),
    hasMore: z.boolean(),
  })
  .catchall(z.unknown());

export type Visits_IssueVisitRequest = __TypedOpenapi.Schemas.Visits_IssueVisitRequest;
export const Visits_IssueVisitRequest = z
  .object({
    additionalPayment: z.number().int(),
    deposit: z.object({ type: Visits_DepositType, amount: z.number().int().optional() }).catchall(z.unknown()),
    notes: z.string().optional(),
  })
  .catchall(z.unknown());

export type Visits_IssuedForReturnResponse = __TypedOpenapi.Schemas.Visits_IssuedForReturnResponse;
export const Visits_IssuedForReturnResponse = z
  .object({
    visitId: z.number().int(),
    visitCode: Costumes_VisitCode,
    clientName: Clients_ClientName,
    childrenNames: z.string(),
    costumeNames: z.string(),
    endDateTime: z.iso.date(),
    clientPhone: Clients_PhoneString,
    notes: z.string(),
  })
  .catchall(z.unknown());

export type Visits_MarkDepositReturnedResponse = __TypedOpenapi.Schemas.Visits_MarkDepositReturnedResponse;
export const Visits_MarkDepositReturnedResponse = z
  .object({ visitId: z.number().int(), depositReturned: z.boolean(), message: z.string() })
  .catchall(z.unknown());

export type Visits_Order = __TypedOpenapi.Schemas.Visits_Order;
export const Visits_Order = z
  .object({
    orderId: z.number().int(),
    inventoryCode: Costumes_InventoryCode,
    costumeName: z.string(),
    visitCode: Costumes_VisitCode,
    childName: Children_ChildName,
    clientPhone: Clients_PhoneString,
    startDateTime: z.iso.date(),
    endDateTime: z.iso.date(),
    issueTimeFrom: Visits_TimeString,
    issueTimeTo: Visits_TimeString,
    returnTimeUntil: Visits_TimeString,
    rentPrice: z.number().int(),
    prepaymentAmount: z.number().int(),
    notes: z.string(),
  })
  .catchall(z.unknown());

export type Visits_NotWrittenOrdersResponse = __TypedOpenapi.Schemas.Visits_NotWrittenOrdersResponse;
export const Visits_NotWrittenOrdersResponse = z
  .object({ items: z.array(Visits_Order), message: z.string().optional() })
  .catchall(z.unknown());

export type Visits_Notification = __TypedOpenapi.Schemas.Visits_Notification;
export const Visits_Notification = z
  .object({
    id: z.number().int(),
    type: z.string(),
    status: z.enum(["pending", "sent", "delivered", "failed", "read"]),
    createdAt: z.iso.datetime(),
  })
  .catchall(z.unknown());

export type Visits_PaginatedReservedResponse = __TypedOpenapi.Schemas.Visits_PaginatedReservedResponse;
export const Visits_PaginatedReservedResponse = z
  .object({
    items: z.array(Visits_GetReservedResponse),
    total: z.number().int(),
    page: z.number().int(),
    limit: z.number().int(),
    hasMore: z.boolean(),
  })
  .catchall(z.unknown());

export type Visits_TagStatus = __TypedOpenapi.Schemas.Visits_TagStatus;
export const Visits_TagStatus = z.enum(["written", "not_written"]);

export type Visits_VisitOrder = __TypedOpenapi.Schemas.Visits_VisitOrder;
export const Visits_VisitOrder = z
  .object({
    orderId: z.number().int(),
    childName: Children_ChildName,
    costumeName: z.string(),
    inventoryCode: Costumes_InventoryCode,
    rentPrice: z.number().int(),
    prepaymentAmount: z.number().int(),
    tagStatus: Visits_TagStatus,
  })
  .catchall(z.unknown());

export type Visits_Visit = __TypedOpenapi.Schemas.Visits_Visit;
export const Visits_Visit = z
  .object({
    id: z.number().int(),
    visitCode: Costumes_VisitCode,
    status: Visits_VisitStatus,
    client: z
      .object({ id: z.number().int(), fullname: Clients_ClientName, phone: Clients_PhoneString })
      .catchall(z.unknown()),
    visitDate: z
      .object({
        startDateTime: z.iso.date(),
        endDateTime: z.iso.date(),
        issueTimeFrom: Visits_TimeString,
        issueTimeTo: Visits_TimeString,
        returnTimeUntil: Visits_TimeString,
      })
      .catchall(z.unknown()),
    notifications: z.array(Visits_Notification),
    orders: z.array(Visits_VisitOrder),
  })
  .catchall(z.unknown());

export type Visits_VisitCancelRequest = __TypedOpenapi.Schemas.Visits_VisitCancelRequest;
export const Visits_VisitCancelRequest = z.object({ reason: z.string() }).partial().catchall(z.unknown());

export type Visits_VisitForIssueResponse = __TypedOpenapi.Schemas.Visits_VisitForIssueResponse;
export const Visits_VisitForIssueResponse = z
  .object({
    visitId: z.number().int(),
    visitCode: Costumes_VisitCode,
    client: z.object({ name: Clients_ClientName, phone: Clients_PhoneString }).catchall(z.unknown()),
    startDateTime: z.iso.date(),
    issueTimeFrom: Visits_TimeString,
    issueTimeTo: Visits_TimeString,
    returnTimeUntil: Visits_TimeString,
    endDateTime: z.iso.date(),
    totalRentPrice: z.number().int(),
    totalPrepayment: z.number().int(),
    remainingToPay: z.number().int(),
    notes: z.string(),
    orders: z.array(Visits_VisitOrder),
  })
  .catchall(z.unknown());

export type Visits_VisitReturnOrder = __TypedOpenapi.Schemas.Visits_VisitReturnOrder;
export const Visits_VisitReturnOrder = z
  .object({
    orderId: z.number().int(),
    childName: Children_ChildName,
    costumeName: z.string(),
    inventoryCode: Costumes_InventoryCode,
    rentPrice: z.number().int(),
    prepaymentAmount: z.number().int(),
    finalPayment: z.number().int(),
    returned: z.boolean(),
  })
  .catchall(z.unknown());

export type Visits_VisitForReturnResponse = __TypedOpenapi.Schemas.Visits_VisitForReturnResponse;
export const Visits_VisitForReturnResponse = z
  .object({
    visitId: z.number().int(),
    visitCode: Costumes_VisitCode,
    client: z.object({ name: Clients_ClientName, phone: Clients_PhoneString }).catchall(z.unknown()),
    startDateTime: z.iso.date(),
    endDateTime: z.iso.date(),
    notes: z.string(),
    orders: z.array(Visits_VisitReturnOrder),
    deposit: Visits_VisitDepositInfo,
  })
  .catchall(z.unknown());

export type Visits_VisitReturnSearchResponse = __TypedOpenapi.Schemas.Visits_VisitReturnSearchResponse;
export const Visits_VisitReturnSearchResponse = z
  .object({
    visitId: z.number().int(),
    visitCode: Costumes_VisitCode,
    childrenNames: z.string(),
    costumesNames: z.string(),
    returnDate: z.iso.date(),
    clientPhone: Clients_PhoneString,
    clientName: Clients_ClientName,
  })
  .catchall(z.unknown());

export type Visits_VisitsSearchResponse = __TypedOpenapi.Schemas.Visits_VisitsSearchResponse;
export const Visits_VisitsSearchResponse = z
  .object({
    visitId: z.number().int(),
    visitCode: Costumes_VisitCode,
    clientName: Clients_ClientName,
    clientPhone: Clients_PhoneString,
    startDateTime: z.iso.date(),
    childrenNames: z.string(),
    costumesNames: z.string(),
  })
  .catchall(z.unknown());

// </Schemas>

// <Endpoints>
export type post_AuthOperations_login = __TypedOpenapi.Endpoints.post_AuthOperations_login;
export const post_AuthOperations_login = {
  method: z.literal("POST"),
  path: z.literal("/auth/login"),
  requestFormat: z.literal("json"),
  responseFormat: z.literal("json"),
  parameters: { body: Auth_LoginRequest },
  responses: { 201: Auth_LoginSuccessResponse, default: Common_Error },
  responseHeaders: { 201: z.strictObject({ "Set-Cookie": z.string() }) },
};

export type post_AuthOperations_logout = __TypedOpenapi.Endpoints.post_AuthOperations_logout;
export const post_AuthOperations_logout = {
  method: z.literal("POST"),
  path: z.literal("/auth/logout"),
  requestFormat: z.literal("json"),
  responseFormat: z.literal("json"),
  parameters: z.never(),
  responses: { 204: z.unknown(), default: Common_Error },
  responseHeaders: { 204: z.strictObject({ "Set-Cookie": z.string() }) },
};

export type post_AuthOperations_refresh = __TypedOpenapi.Endpoints.post_AuthOperations_refresh;
export const post_AuthOperations_refresh = {
  method: z.literal("POST"),
  path: z.literal("/auth/refresh"),
  requestFormat: z.literal("json"),
  responseFormat: z.literal("json"),
  parameters: { header: z.strictObject({ Cookie: z.string() }) },
  responses: { 201: Auth_RefreshSuccessResponse, default: Common_Error },
};

export type post_ChildOperations_create = __TypedOpenapi.Endpoints.post_ChildOperations_create;
export const post_ChildOperations_create = {
  method: z.literal("POST"),
  path: z.literal("/children"),
  requestFormat: z.literal("json"),
  responseFormat: z.literal("json"),
  parameters: { body: Children_CreateChildRequest },
  responses: { 201: Children_ChildResponse, default: Common_Error },
};

export type patch_ChildOperations_update = __TypedOpenapi.Endpoints.patch_ChildOperations_update;
export const patch_ChildOperations_update = {
  method: z.literal("PATCH"),
  path: z.literal("/children/{childId}"),
  requestFormat: z.literal("json"),
  responseFormat: z.literal("json"),
  parameters: { path: z.strictObject({ childId: z.coerce.number().int() }), body: Children_UpdateChildRequest },
  responses: { 200: Children_ChildUpdateResponse, default: Common_Error },
};

export type delete_ChildOperations_delete = __TypedOpenapi.Endpoints.delete_ChildOperations_delete;
export const delete_ChildOperations_delete = {
  method: z.literal("DELETE"),
  path: z.literal("/children/{childId}"),
  requestFormat: z.literal("json"),
  responseFormat: z.literal("json"),
  parameters: { path: z.strictObject({ childId: z.coerce.number().int() }) },
  responses: { 204: z.unknown(), default: Common_Error },
};

export type post_ClientOperations_create = __TypedOpenapi.Endpoints.post_ClientOperations_create;
export const post_ClientOperations_create = {
  method: z.literal("POST"),
  path: z.literal("/clients"),
  requestFormat: z.literal("json"),
  responseFormat: z.literal("json"),
  parameters: { body: Clients_CreateClientRequest },
  responses: { 201: Clients_Client, default: Common_Error },
};

export type get_ClientOperations_getClientDetail = __TypedOpenapi.Endpoints.get_ClientOperations_getClientDetail;
export const get_ClientOperations_getClientDetail = {
  method: z.literal("GET"),
  path: z.literal("/clients/detail/{clientId}"),
  requestFormat: z.literal("json"),
  responseFormat: z.literal("json"),
  parameters: { path: z.strictObject({ clientId: z.coerce.number().int() }) },
  responses: { 200: Clients_GetClientDetailed, default: Common_Error },
};

export type get_ClientOperations_getClientList = __TypedOpenapi.Endpoints.get_ClientOperations_getClientList;
export const get_ClientOperations_getClientList = {
  method: z.literal("GET"),
  path: z.literal("/clients/list"),
  requestFormat: z.literal("json"),
  responseFormat: z.literal("json"),
  parameters: {
    query: z.strictObject({ page: z.coerce.number().int(), limit: z.coerce.number().int() }).partial().optional(),
  },
  responses: { 200: Clients_GetClientList, default: Common_Error },
};

export type get_ClientOperations_search = __TypedOpenapi.Endpoints.get_ClientOperations_search;
export const get_ClientOperations_search = {
  method: z.literal("GET"),
  path: z.literal("/clients/search"),
  requestFormat: z.literal("json"),
  responseFormat: z.literal("json"),
  parameters: { query: z.strictObject({ q: z.string().min(2) }) },
  responses: { 200: z.array(Clients_Client), default: Common_Error },
};

export type patch_ClientOperations_update = __TypedOpenapi.Endpoints.patch_ClientOperations_update;
export const patch_ClientOperations_update = {
  method: z.literal("PATCH"),
  path: z.literal("/clients/{clientId}"),
  requestFormat: z.literal("json"),
  responseFormat: z.literal("json"),
  parameters: { path: z.strictObject({ clientId: z.coerce.number().int() }), body: Clients_UpdateClientRequest },
  responses: { 200: Clients_Client, default: Common_Error },
};

export type delete_ClientOperations_delete = __TypedOpenapi.Endpoints.delete_ClientOperations_delete;
export const delete_ClientOperations_delete = {
  method: z.literal("DELETE"),
  path: z.literal("/clients/{clientId}"),
  requestFormat: z.literal("json"),
  responseFormat: z.literal("json"),
  parameters: { path: z.strictObject({ clientId: z.coerce.number().int() }) },
  responses: { 204: z.unknown(), default: Common_Error },
};

export type post_ClientOperations_addClientInBlackList =
  __TypedOpenapi.Endpoints.post_ClientOperations_addClientInBlackList;
export const post_ClientOperations_addClientInBlackList = {
  method: z.literal("POST"),
  path: z.literal("/clients/{clientId}/blacklist"),
  requestFormat: z.literal("json"),
  responseFormat: z.literal("json"),
  parameters: { path: z.strictObject({ clientId: z.coerce.number().int() }), body: Clients_blacklistReason },
  responses: { 201: z.unknown(), default: Common_Error },
};

export type delete_ClientOperations_removeClientFromBlackList =
  __TypedOpenapi.Endpoints.delete_ClientOperations_removeClientFromBlackList;
export const delete_ClientOperations_removeClientFromBlackList = {
  method: z.literal("DELETE"),
  path: z.literal("/clients/{clientId}/blacklist"),
  requestFormat: z.literal("json"),
  responseFormat: z.literal("json"),
  parameters: { path: z.strictObject({ clientId: z.coerce.number().int() }) },
  responses: { 204: z.unknown(), default: Common_Error },
};

export type post_CostumeOperations_create = __TypedOpenapi.Endpoints.post_CostumeOperations_create;
export const post_CostumeOperations_create = {
  method: z.literal("POST"),
  path: z.literal("/costumes"),
  requestFormat: z.literal("json"),
  responseFormat: z.literal("json"),
  parameters: { body: Costumes_CreateCostumeRequest },
  responses: { 201: Costumes_Costume, default: Common_Error },
};

export type get_CostumeOperations_getCostumesList = __TypedOpenapi.Endpoints.get_CostumeOperations_getCostumesList;
export const get_CostumeOperations_getCostumesList = {
  method: z.literal("GET"),
  path: z.literal("/costumes/list"),
  requestFormat: z.literal("json"),
  responseFormat: z.literal("json"),
  parameters: {
    query: z.strictObject({ page: z.coerce.number().int(), limit: z.coerce.number().int() }).partial().optional(),
  },
  responses: { 200: Costumes_GetCostumesList, default: Common_Error },
};

export type get_CostumeOperations_searchAvailability =
  __TypedOpenapi.Endpoints.get_CostumeOperations_searchAvailability;
export const get_CostumeOperations_searchAvailability = {
  method: z.literal("GET"),
  path: z.literal("/costumes/search"),
  requestFormat: z.literal("json"),
  responseFormat: z.literal("json"),
  parameters: { query: z.strictObject({ q: z.string() }) },
  responses: { 200: z.array(Costumes_CostumeSearchResult), default: Common_Error },
};

export type get_CostumeOperations_searchAvailable = __TypedOpenapi.Endpoints.get_CostumeOperations_searchAvailable;
export const get_CostumeOperations_searchAvailable = {
  method: z.literal("GET"),
  path: z.literal("/costumes/search-available"),
  requestFormat: z.literal("json"),
  responseFormat: z.literal("json"),
  parameters: { query: z.strictObject({ q: z.string().optional(), startDate: z.string(), endDate: z.string() }) },
  responses: { 200: z.array(Costumes_AvailableCostume), default: Common_Error },
};

export type patch_CostumeOperations_update = __TypedOpenapi.Endpoints.patch_CostumeOperations_update;
export const patch_CostumeOperations_update = {
  method: z.literal("PATCH"),
  path: z.literal("/costumes/{costumeId}"),
  requestFormat: z.literal("json"),
  responseFormat: z.literal("json"),
  parameters: { path: z.strictObject({ costumeId: z.coerce.number().int() }), body: Costumes_UpdateCostumeRequest },
  responses: { 200: Costumes_Costume, default: Common_Error },
};

export type delete_CostumeOperations_delete = __TypedOpenapi.Endpoints.delete_CostumeOperations_delete;
export const delete_CostumeOperations_delete = {
  method: z.literal("DELETE"),
  path: z.literal("/costumes/{costumeId}"),
  requestFormat: z.literal("json"),
  responseFormat: z.literal("json"),
  parameters: { path: z.strictObject({ costumeId: z.coerce.number().int() }) },
  responses: { 204: z.unknown(), default: Common_Error },
};

export type get_CostumeOperations_getDetailedAvailability =
  __TypedOpenapi.Endpoints.get_CostumeOperations_getDetailedAvailability;
export const get_CostumeOperations_getDetailedAvailability = {
  method: z.literal("GET"),
  path: z.literal("/costumes/{costumeId}/availability"),
  requestFormat: z.literal("json"),
  responseFormat: z.literal("json"),
  parameters: { path: z.strictObject({ costumeId: z.coerce.number().int() }) },
  responses: { 200: Costumes_CostumeFullAvailability, default: Common_Error },
};

export type post_VisitOperation_create = __TypedOpenapi.Endpoints.post_VisitOperation_create;
export const post_VisitOperation_create = {
  method: z.literal("POST"),
  path: z.literal("/visits"),
  requestFormat: z.literal("json"),
  responseFormat: z.literal("json"),
  parameters: {
    query: z
      .strictObject({
        sendNotification: z
          .union([z.boolean(), z.string(), z.number()])
          .transform((x) => x === true || x === "true" || x === 1 || x === "1")
          .default(true),
      })
      .partial()
      .optional(),
    body: Visits_CreateVisitRequest,
  },
  responses: { 201: Visits_Visit, default: Common_Error },
};

export type get_VisitOperation_getIssuedVisits = __TypedOpenapi.Endpoints.get_VisitOperation_getIssuedVisits;
export const get_VisitOperation_getIssuedVisits = {
  method: z.literal("GET"),
  path: z.literal("/visits/issued"),
  requestFormat: z.literal("json"),
  responseFormat: z.literal("json"),
  parameters: {
    query: z.strictObject({ page: z.coerce.number().int(), limit: z.coerce.number().int() }).partial().optional(),
  },
  responses: { 200: Visits_GetIssuedResponse, default: Common_Error },
};

export type get_VisitOperation_getIssuedForReturn = __TypedOpenapi.Endpoints.get_VisitOperation_getIssuedForReturn;
export const get_VisitOperation_getIssuedForReturn = {
  method: z.literal("GET"),
  path: z.literal("/visits/issued-for-return"),
  requestFormat: z.literal("json"),
  responseFormat: z.literal("json"),
  parameters: z.never(),
  responses: { 200: z.array(Visits_IssuedForReturnResponse), default: Common_Error },
};

export type get_VisitOperation_getNotWritten = __TypedOpenapi.Endpoints.get_VisitOperation_getNotWritten;
export const get_VisitOperation_getNotWritten = {
  method: z.literal("GET"),
  path: z.literal("/visits/not_written"),
  requestFormat: z.literal("json"),
  responseFormat: z.literal("json"),
  parameters: z.never(),
  responses: { 200: Visits_NotWrittenOrdersResponse, default: Common_Error },
};

export type get_VisitOperation_getVisitNotification = __TypedOpenapi.Endpoints.get_VisitOperation_getVisitNotification;
export const get_VisitOperation_getVisitNotification = {
  method: z.literal("GET"),
  path: z.literal("/visits/notification"),
  requestFormat: z.literal("json"),
  responseFormat: z.literal("json"),
  parameters: {
    query: z.strictObject({ page: z.coerce.number().int(), limit: z.coerce.number().int() }).partial().optional(),
  },
  responses: { 200: Visits_GetNotificationResponse, default: Common_Error },
};

export type get_VisitOperation_searchNotification = __TypedOpenapi.Endpoints.get_VisitOperation_searchNotification;
export const get_VisitOperation_searchNotification = {
  method: z.literal("GET"),
  path: z.literal("/visits/notification-search"),
  requestFormat: z.literal("json"),
  responseFormat: z.literal("json"),
  parameters: { query: z.strictObject({ q: z.string().min(2) }) },
  responses: { 200: z.array(Visits_NotificationItem), default: Common_Error },
};

export type post_VisitOperation_previewCode = __TypedOpenapi.Endpoints.post_VisitOperation_previewCode;
export const post_VisitOperation_previewCode = {
  method: z.literal("POST"),
  path: z.literal("/visits/preview-code"),
  requestFormat: z.literal("json"),
  responseFormat: z.literal("json"),
  parameters: z.never(),
  responses: { 201: Costumes_VisitCode, default: Common_Error },
};

export type get_VisitOperation_getReserved = __TypedOpenapi.Endpoints.get_VisitOperation_getReserved;
export const get_VisitOperation_getReserved = {
  method: z.literal("GET"),
  path: z.literal("/visits/reserved"),
  requestFormat: z.literal("json"),
  responseFormat: z.literal("json"),
  parameters: {
    query: z
      .strictObject({
        startDate: z.string(),
        endDate: z.string(),
        page: z.coerce.number().int(),
        limit: z.coerce.number().int(),
      })
      .partial()
      .optional(),
  },
  responses: { 200: Visits_PaginatedReservedResponse, default: Common_Error },
};

export type get_VisitOperation_searchForReturn = __TypedOpenapi.Endpoints.get_VisitOperation_searchForReturn;
export const get_VisitOperation_searchForReturn = {
  method: z.literal("GET"),
  path: z.literal("/visits/return-search"),
  requestFormat: z.literal("json"),
  responseFormat: z.literal("json"),
  parameters: { query: z.strictObject({ q: z.string().min(2) }) },
  responses: { 200: z.array(Visits_VisitReturnSearchResponse), default: Common_Error },
};

export type get_VisitOperation_search = __TypedOpenapi.Endpoints.get_VisitOperation_search;
export const get_VisitOperation_search = {
  method: z.literal("GET"),
  path: z.literal("/visits/search"),
  requestFormat: z.literal("json"),
  responseFormat: z.literal("json"),
  parameters: { query: z.strictObject({ q: z.string().min(2) }) },
  responses: { 200: z.array(Visits_VisitsSearchResponse), default: Common_Error },
};

export type get_VisitOperation_getUnreturnedDeposits =
  __TypedOpenapi.Endpoints.get_VisitOperation_getUnreturnedDeposits;
export const get_VisitOperation_getUnreturnedDeposits = {
  method: z.literal("GET"),
  path: z.literal("/visits/unreturned-deposits"),
  requestFormat: z.literal("json"),
  responseFormat: z.literal("json"),
  parameters: {
    query: z.strictObject({ page: z.coerce.number().int(), limit: z.coerce.number().int() }).partial().optional(),
  },
  responses: { 200: Visits_GetUnreturnedDepositsResponse, default: Common_Error },
};

export type post_VisitOperation_markTagWritten = __TypedOpenapi.Endpoints.post_VisitOperation_markTagWritten;
export const post_VisitOperation_markTagWritten = {
  method: z.literal("POST"),
  path: z.literal("/visits/{orderId}/mark-tag-written"),
  requestFormat: z.literal("json"),
  responseFormat: z.literal("json"),
  parameters: { path: z.strictObject({ orderId: z.coerce.number().int() }) },
  responses: { 204: z.unknown(), default: Common_Error },
};

export type post_VisitOperation_cancel = __TypedOpenapi.Endpoints.post_VisitOperation_cancel;
export const post_VisitOperation_cancel = {
  method: z.literal("POST"),
  path: z.literal("/visits/{visitId}/cancel"),
  requestFormat: z.literal("json"),
  responseFormat: z.literal("json"),
  parameters: { path: z.strictObject({ visitId: z.coerce.number().int() }), body: Visits_VisitCancelRequest },
  responses: {
    204: z.unknown(),
    400: z.object({ body: z.string() }).catchall(z.unknown()),
    404: z.object({ body: z.string() }).catchall(z.unknown()),
  },
};

export type post_VisitOperation_completeReturn = __TypedOpenapi.Endpoints.post_VisitOperation_completeReturn;
export const post_VisitOperation_completeReturn = {
  method: z.literal("POST"),
  path: z.literal("/visits/{visitId}/complete-return"),
  requestFormat: z.literal("json"),
  responseFormat: z.literal("json"),
  parameters: { path: z.strictObject({ visitId: z.coerce.number().int() }), body: Visits_CompleteReturnRequest },
  responses: { 200: Visits_CompleteReturnResponse, default: Common_Error },
};

export type get_VisitOperation_getForIssue = __TypedOpenapi.Endpoints.get_VisitOperation_getForIssue;
export const get_VisitOperation_getForIssue = {
  method: z.literal("GET"),
  path: z.literal("/visits/{visitId}/for-issue"),
  requestFormat: z.literal("json"),
  responseFormat: z.literal("json"),
  parameters: { path: z.strictObject({ visitId: z.coerce.number().int() }) },
  responses: { 200: Visits_VisitForIssueResponse, default: Common_Error },
};

export type get_VisitOperation_getForReturn = __TypedOpenapi.Endpoints.get_VisitOperation_getForReturn;
export const get_VisitOperation_getForReturn = {
  method: z.literal("GET"),
  path: z.literal("/visits/{visitId}/for-return"),
  requestFormat: z.literal("json"),
  responseFormat: z.literal("json"),
  parameters: { path: z.strictObject({ visitId: z.coerce.number().int() }) },
  responses: { 200: Visits_VisitForReturnResponse, default: Common_Error },
};

export type post_VisitOperation_issue = __TypedOpenapi.Endpoints.post_VisitOperation_issue;
export const post_VisitOperation_issue = {
  method: z.literal("POST"),
  path: z.literal("/visits/{visitId}/issue"),
  requestFormat: z.literal("json"),
  responseFormat: z.literal("json"),
  parameters: { path: z.strictObject({ visitId: z.coerce.number().int() }), body: Visits_IssueVisitRequest },
  responses: { 204: z.unknown(), default: Common_Error },
};

export type post_VisitOperation_markDepositReturned = __TypedOpenapi.Endpoints.post_VisitOperation_markDepositReturned;
export const post_VisitOperation_markDepositReturned = {
  method: z.literal("POST"),
  path: z.literal("/visits/{visitId}/mark-deposit-returned"),
  requestFormat: z.literal("json"),
  responseFormat: z.literal("json"),
  parameters: {
    path: z.strictObject({ visitId: z.coerce.number().int() }),
    body: z.object({ notes: z.string() }).partial().catchall(z.unknown()).optional(),
  },
  responses: { 200: Visits_MarkDepositReturnedResponse, default: Common_Error },
};

export type post_VisitOperation_unissue = __TypedOpenapi.Endpoints.post_VisitOperation_unissue;
export const post_VisitOperation_unissue = {
  method: z.literal("POST"),
  path: z.literal("/visits/{visitId}/unissue"),
  requestFormat: z.literal("json"),
  responseFormat: z.literal("json"),
  parameters: { path: z.strictObject({ visitId: z.coerce.number().int() }) },
  responses: { 204: z.unknown(), default: Common_Error },
};

// </Endpoints>

// <EndpointByMethod>
export const EndpointByMethod = {
  post: {
    "/auth/login": post_AuthOperations_login,
    "/auth/logout": post_AuthOperations_logout,
    "/auth/refresh": post_AuthOperations_refresh,
    "/children": post_ChildOperations_create,
    "/clients": post_ClientOperations_create,
    "/clients/{clientId}/blacklist": post_ClientOperations_addClientInBlackList,
    "/costumes": post_CostumeOperations_create,
    "/visits": post_VisitOperation_create,
    "/visits/preview-code": post_VisitOperation_previewCode,
    "/visits/{orderId}/mark-tag-written": post_VisitOperation_markTagWritten,
    "/visits/{visitId}/cancel": post_VisitOperation_cancel,
    "/visits/{visitId}/complete-return": post_VisitOperation_completeReturn,
    "/visits/{visitId}/issue": post_VisitOperation_issue,
    "/visits/{visitId}/mark-deposit-returned": post_VisitOperation_markDepositReturned,
    "/visits/{visitId}/unissue": post_VisitOperation_unissue,
  },
  patch: {
    "/children/{childId}": patch_ChildOperations_update,
    "/clients/{clientId}": patch_ClientOperations_update,
    "/costumes/{costumeId}": patch_CostumeOperations_update,
  },
  delete: {
    "/children/{childId}": delete_ChildOperations_delete,
    "/clients/{clientId}": delete_ClientOperations_delete,
    "/clients/{clientId}/blacklist": delete_ClientOperations_removeClientFromBlackList,
    "/costumes/{costumeId}": delete_CostumeOperations_delete,
  },
  get: {
    "/clients/detail/{clientId}": get_ClientOperations_getClientDetail,
    "/clients/list": get_ClientOperations_getClientList,
    "/clients/search": get_ClientOperations_search,
    "/costumes/list": get_CostumeOperations_getCostumesList,
    "/costumes/search": get_CostumeOperations_searchAvailability,
    "/costumes/search-available": get_CostumeOperations_searchAvailable,
    "/costumes/{costumeId}/availability": get_CostumeOperations_getDetailedAvailability,
    "/visits/issued": get_VisitOperation_getIssuedVisits,
    "/visits/issued-for-return": get_VisitOperation_getIssuedForReturn,
    "/visits/not_written": get_VisitOperation_getNotWritten,
    "/visits/notification": get_VisitOperation_getVisitNotification,
    "/visits/notification-search": get_VisitOperation_searchNotification,
    "/visits/reserved": get_VisitOperation_getReserved,
    "/visits/return-search": get_VisitOperation_searchForReturn,
    "/visits/search": get_VisitOperation_search,
    "/visits/unreturned-deposits": get_VisitOperation_getUnreturnedDeposits,
    "/visits/{visitId}/for-issue": get_VisitOperation_getForIssue,
    "/visits/{visitId}/for-return": get_VisitOperation_getForReturn,
  },
} satisfies {
  [M in keyof __TypedOpenapi.EndpointByMethod]: { [P in keyof __TypedOpenapi.EndpointByMethod[M]]: unknown };
};
export type EndpointByMethod = __TypedOpenapi.EndpointByMethod;
// </EndpointByMethod>

// <EndpointByMethod.Shorthands>
export type PostEndpoints = EndpointByMethod["post"];
export type PatchEndpoints = EndpointByMethod["patch"];
export type DeleteEndpoints = EndpointByMethod["delete"];
export type GetEndpoints = EndpointByMethod["get"];
// </EndpointByMethod.Shorthands>

// <ApiClientTypes>
export type EndpointParameters = {
  body?: unknown;
  query?: unknown;
  header?: unknown;
  path?: unknown;
  cookie?: unknown;
};

export type MutationMethod = "post" | "put" | "patch" | "delete";
export type Method = "get" | "head" | "options" | "trace" | MutationMethod;

export type RequestFormat = "json" | "form-data" | "form-url" | "binary" | "text";
export type ResponseFormat = "json" | "sse";
export type SecurityRequirements = readonly (readonly string[])[];

// <EndpointRequestFormats>
/** Non-json request body encodings; missing entries default to `"json"`. */
export const endpointRequestFormats = {} as Partial<{
  [M in keyof EndpointByMethod]: Partial<{ [P in keyof EndpointByMethod[M]]: RequestFormat }>;
}>;
// </EndpointRequestFormats>

// <EndpointParameterStyles>
export type ParameterSerialization = { style: string; explode: boolean; allowReserved: boolean };
export type EndpointParameterStyles = Partial<
  Record<"query" | "path" | "header" | "cookie", Record<string, ParameterSerialization>>
>;
/** OpenAPI parameter styles used by the built-in encoders. */
export const endpointParameterStyles = {
  post: {
    "/auth/refresh": { header: { Cookie: { style: "simple", explode: false, allowReserved: false } } },
    "/clients/{clientId}/blacklist": { path: { clientId: { style: "simple", explode: false, allowReserved: false } } },
    "/visits": { query: { sendNotification: { style: "form", explode: false, allowReserved: false } } },
    "/visits/{orderId}/mark-tag-written": {
      path: { orderId: { style: "simple", explode: false, allowReserved: false } },
    },
    "/visits/{visitId}/cancel": { path: { visitId: { style: "simple", explode: false, allowReserved: false } } },
    "/visits/{visitId}/complete-return": {
      path: { visitId: { style: "simple", explode: false, allowReserved: false } },
    },
    "/visits/{visitId}/issue": { path: { visitId: { style: "simple", explode: false, allowReserved: false } } },
    "/visits/{visitId}/mark-deposit-returned": {
      path: { visitId: { style: "simple", explode: false, allowReserved: false } },
    },
    "/visits/{visitId}/unissue": { path: { visitId: { style: "simple", explode: false, allowReserved: false } } },
  },
  patch: {
    "/children/{childId}": { path: { childId: { style: "simple", explode: false, allowReserved: false } } },
    "/clients/{clientId}": { path: { clientId: { style: "simple", explode: false, allowReserved: false } } },
    "/costumes/{costumeId}": { path: { costumeId: { style: "simple", explode: false, allowReserved: false } } },
  },
  delete: {
    "/children/{childId}": { path: { childId: { style: "simple", explode: false, allowReserved: false } } },
    "/clients/{clientId}": { path: { clientId: { style: "simple", explode: false, allowReserved: false } } },
    "/clients/{clientId}/blacklist": { path: { clientId: { style: "simple", explode: false, allowReserved: false } } },
    "/costumes/{costumeId}": { path: { costumeId: { style: "simple", explode: false, allowReserved: false } } },
  },
  get: {
    "/clients/detail/{clientId}": { path: { clientId: { style: "simple", explode: false, allowReserved: false } } },
    "/clients/list": {
      query: {
        page: { style: "form", explode: false, allowReserved: false },
        limit: { style: "form", explode: false, allowReserved: false },
      },
    },
    "/clients/search": { query: { q: { style: "form", explode: false, allowReserved: false } } },
    "/costumes/list": {
      query: {
        page: { style: "form", explode: false, allowReserved: false },
        limit: { style: "form", explode: false, allowReserved: false },
      },
    },
    "/costumes/search": { query: { q: { style: "form", explode: false, allowReserved: false } } },
    "/costumes/search-available": {
      query: {
        q: { style: "form", explode: false, allowReserved: false },
        startDate: { style: "form", explode: false, allowReserved: false },
        endDate: { style: "form", explode: false, allowReserved: false },
      },
    },
    "/costumes/{costumeId}/availability": {
      path: { costumeId: { style: "simple", explode: false, allowReserved: false } },
    },
    "/visits/issued": {
      query: {
        page: { style: "form", explode: false, allowReserved: false },
        limit: { style: "form", explode: false, allowReserved: false },
      },
    },
    "/visits/notification": {
      query: {
        page: { style: "form", explode: false, allowReserved: false },
        limit: { style: "form", explode: false, allowReserved: false },
      },
    },
    "/visits/notification-search": { query: { q: { style: "form", explode: false, allowReserved: false } } },
    "/visits/reserved": {
      query: {
        startDate: { style: "form", explode: false, allowReserved: false },
        endDate: { style: "form", explode: false, allowReserved: false },
        page: { style: "form", explode: false, allowReserved: false },
        limit: { style: "form", explode: false, allowReserved: false },
      },
    },
    "/visits/return-search": { query: { q: { style: "form", explode: false, allowReserved: false } } },
    "/visits/search": { query: { q: { style: "form", explode: false, allowReserved: false } } },
    "/visits/unreturned-deposits": {
      query: {
        page: { style: "form", explode: false, allowReserved: false },
        limit: { style: "form", explode: false, allowReserved: false },
      },
    },
    "/visits/{visitId}/for-issue": { path: { visitId: { style: "simple", explode: false, allowReserved: false } } },
    "/visits/{visitId}/for-return": { path: { visitId: { style: "simple", explode: false, allowReserved: false } } },
  },
} as Partial<Record<string, Partial<Record<string, EndpointParameterStyles>>>>;
// </EndpointParameterStyles>

// <EndpointResponseFormats>
/** Non-json response body modes; missing entries default to `"json"`. SSE skips JSON parse + output validation. */
export const endpointResponseFormats = {} as Partial<{
  [M in keyof EndpointByMethod]: Partial<{ [P in keyof EndpointByMethod[M]]: ResponseFormat }>;
}>;
// </EndpointResponseFormats>

// <EndpointSecurityRequirements>
/** OpenAPI security requirements applied when an endpoint has no explicit entry. */
export const defaultSecurityRequirements = [["BearerAuth"]] as SecurityRequirements;
/** Endpoint-specific security requirements that differ from the default. */
export const endpointSecurityRequirements = {
  post: { "/auth/login": [[]], "/auth/refresh": [[]] },
} as Partial<{ [M in keyof EndpointByMethod]: Partial<{ [P in keyof EndpointByMethod[M]]: SecurityRequirements }> }>;
// </EndpointSecurityRequirements>

export type DefaultEndpoint = {
  parameters?: EndpointParameters | undefined;
  responses?: Record<string, unknown>;
  responseHeaders?: Record<string, unknown>;
};

export type Endpoint<TConfig extends DefaultEndpoint = DefaultEndpoint> = {
  operationId: string;
  method: Method;
  path: string;
  requestFormat: RequestFormat;
  responseFormat: ResponseFormat;
  parameters?: TConfig["parameters"];
  meta: {
    alias: string;
    hasParameters: boolean;
    areParametersRequired: boolean;
  };
  responses?: TConfig["responses"];
  responseHeaders?: TConfig["responseHeaders"];
};

/**
 * Minimal response surface used by ApiClient — avoids depending on the DOM `Response`
 * global (helpful for Node without DOM lib). Structural typing accepts fetch Response.
 */
export interface FetcherResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers: {
    get(name: string): string | null;
    getSetCookie?: () => string[];
  };
  /** Present on fetch Response; used for SSE / streaming bodies. */
  body?: ReadableStream<Uint8Array> | null;
  json(): Promise<unknown>;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
  clone(): FetcherResponse;
}

export interface Fetcher {
  decodePathParams?: (path: string, pathParams: unknown, styles?: Record<string, ParameterSerialization>) => string;
  encodeSearchParams?: (
    searchParams: unknown,
    styles?: Record<string, ParameterSerialization>,
  ) => URLSearchParams | undefined;
  /** Merge cookie params into request headers (default: Cookie header). */
  encodeCookies?: (cookies: unknown, headers: Headers) => void;
  //
  fetch: (input: {
    method: Method;
    url: URL;
    urlSearchParams?: URLSearchParams | undefined;
    parameters?: EndpointParameters | undefined;
    path: string;
    /** How to encode `parameters.body` (from OpenAPI requestBody content type). */
    requestFormat: RequestFormat;
    /** OpenAPI parameter serialization metadata for the current endpoint. */
    parameterStyles?: EndpointParameterStyles;
    /** OpenAPI security requirements for this operation. Empty means no credentials are required. */
    security?: SecurityRequirements;
    overrides?: RequestInit;
    throwOnStatusError?: boolean;
  }) => Promise<FetcherResponse>;
  parseResponseData?: (response: FetcherResponse) => Promise<unknown>;
}

export const successStatusCodes = [
  200, 201, 202, 203, 204, 205, 206, 207, 208, 226, 300, 301, 302, 303, 304, 305, 306, 307, 308,
] as const;
export type SuccessStatusCode = (typeof successStatusCodes)[number];

export const errorStatusCodes = [
  400, 401, 402, 403, 404, 405, 406, 407, 408, 409, 410, 411, 412, 413, 414, 415, 416, 417, 418, 421, 422, 423, 424,
  425, 426, 428, 429, 431, 451, 500, 501, 502, 503, 504, 505, 506, 507, 508, 510, 511,
] as const;
export type ErrorStatusCode = (typeof errorStatusCodes)[number];

// Taken from https://github.com/unjs/fetchdts/blob/ec4eaeab5d287116171fc1efd61f4a1ad34e4609/src/fetch.ts#L3
export interface TypedHeaders<TypedHeaderValues = unknown> extends Omit<
  Headers,
  "append" | "delete" | "get" | "getSetCookie" | "has" | "set" | "forEach"
> {
  /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Headers/append) */
  append: <Name extends Extract<keyof TypedHeaderValues, string> | (string & {})>(
    name: Name,
    value: Lowercase<Name> extends keyof TypedHeaderValues ? TypedHeaderValues[Lowercase<Name>] : string,
  ) => void;
  /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Headers/delete) */
  delete: <Name extends Extract<keyof TypedHeaderValues, string> | (string & {})>(name: Name) => void;
  /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Headers/get) */
  get: <Name extends Extract<keyof TypedHeaderValues, string> | (string & {})>(
    name: Name,
  ) => (Lowercase<Name> extends keyof TypedHeaderValues ? TypedHeaderValues[Lowercase<Name>] : string) | null;
  /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Headers/getSetCookie) */
  getSetCookie: () => string[];
  /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Headers/has) */
  has: <Name extends Extract<keyof TypedHeaderValues, string> | (string & {})>(name: Name) => boolean;
  /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Headers/set) */
  set: <Name extends Extract<keyof TypedHeaderValues, string> | (string & {})>(
    name: Name,
    value: Lowercase<Name> extends keyof TypedHeaderValues ? TypedHeaderValues[Lowercase<Name>] : string,
  ) => void;
  forEach: (
    callbackfn: (
      value: TypedHeaderValues[keyof TypedHeaderValues] | (string & {}),
      key: Extract<keyof TypedHeaderValues, string> | (string & {}),
      parent: TypedHeaders<TypedHeaderValues>,
    ) => void,
    thisArg?: unknown,
  ) => void;
}

/** @see https://developer.mozilla.org/en-US/docs/Web/API/Response */
export interface TypedSuccessResponse<TSuccess, TStatusCode, THeaders> extends Omit<
  FetcherResponse,
  "ok" | "status" | "json" | "headers"
> {
  ok: true;
  status: TStatusCode;
  headers: never extends THeaders ? FetcherResponse["headers"] : TypedHeaders<THeaders>;
  data: TSuccess;
  /** [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Response/json) */
  json: () => Promise<TSuccess>;
}

/** @see https://developer.mozilla.org/en-US/docs/Web/API/Response */
export interface TypedErrorResponse<TData, TStatusCode, THeaders> extends Omit<
  FetcherResponse,
  "ok" | "status" | "json" | "headers"
> {
  ok: false;
  status: TStatusCode;
  headers: never extends THeaders ? FetcherResponse["headers"] : TypedHeaders<THeaders>;
  data: TData;
  /** [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Response/json) */
  json: () => Promise<TData>;
}

type StatusCodeFromKey<TKey> = TKey extends `${infer TStatusCode extends number}`
  ? TStatusCode
  : TKey extends number
    ? TKey
    : never;

export type TypedApiResponse<TAllResponses = {}, THeaders = {}> = {
  [K in keyof TAllResponses]: StatusCodeFromKey<K> extends infer TStatusCode extends number
    ? TStatusCode extends SuccessStatusCode
      ? TypedSuccessResponse<TAllResponses[K], TStatusCode, K extends keyof THeaders ? THeaders[K] : never>
      : TypedErrorResponse<TAllResponses[K], TStatusCode, K extends keyof THeaders ? THeaders[K] : never>
    : never;
}[keyof TAllResponses];

type __TypedOpenapiSchema<TOutput, TInput = TOutput> = {
  readonly __typedOpenapiOutput: TOutput;
  readonly __typedOpenapiInput: TInput;
};
type OptionalUndefinedKeys<T> = {
  [K in keyof T as undefined extends T[K] ? never : K]: T[K];
} & {
  [K in keyof T as undefined extends T[K] ? K : never]?: Exclude<T[K], undefined>;
};
export type InferSchemaValue<T> = T extends string | number | boolean | bigint | symbol | null | undefined
  ? T
  : T extends __TypedOpenapiSchema<infer O>
    ? O
    : T extends z.ZodType
      ? z.infer<T>
      : T extends (...args: never[]) => unknown
        ? T
        : T extends object
          ? { [K in keyof T]: InferSchemaValue<T[K]> }
          : T;
type InferSchemaInputRaw<T> = T extends string | number | boolean | bigint | symbol | null | undefined
  ? T
  : T extends __TypedOpenapiSchema<infer _O, infer I>
    ? I
    : T extends z.ZodType
      ? z.input<T>
      : T extends (...args: never[]) => unknown
        ? T
        : T extends object
          ? { [K in keyof T]: InferSchemaInputRaw<T[K]> }
          : T;
type InferSchemaInput<T> = OptionalUndefinedKeys<InferSchemaInputRaw<T>>;

export type SafeApiResponse<TEndpoint> = TEndpoint extends { responses: infer TResponses }
  ? TResponses extends Record<string | number, unknown>
    ? TypedApiResponse<
        InferSchemaValue<TResponses>,
        TEndpoint extends { responseHeaders: infer THeaders } ? InferSchemaValue<THeaders> : never
      >
    : never
  : never;

export type InferResponseByStatus<TEndpoint, TStatusCode> = Extract<
  SafeApiResponse<TEndpoint>,
  { status: TStatusCode }
>;

/**
 * Success-body payload — InferSchemaValue only on success statuses.
 * Filter with extends {} like the old Extract { data: {} } so unknown bodies (e.g. 304) drop out.
 */
export type InferSuccessData<TEndpoint> = TEndpoint extends { responses: infer TResponses }
  ? {
      [K in keyof TResponses]: StatusCodeFromKey<K> extends infer TStatusCode extends number
        ? TStatusCode extends SuccessStatusCode
          ? Extract<InferSchemaValue<TResponses[K]>, {}>
          : never
        : never;
    }[keyof TResponses]
  : never;

type RequiredKeys<T> = {
  [P in keyof T]-?: undefined extends T[P] ? never : P;
}[keyof T];

type MaybeOptionalArg<T> = RequiredKeys<T> extends never ? [config?: T] : [config: T];
type NotNever<T> = [T] extends [never] ? false : true;

export type ApiQueryOptions = {
  /** Override whether a generated TanStack Query consumes TanStack Query's AbortSignal. */
  consumeQuerySignal?: boolean;
};

/** Call options merged onto inferred endpoint parameters. */
type ApiRequestOptions = {
  overrides?: RequestInit;
  queryOptions?: ApiQueryOptions;
  withResponse?: boolean;
  throwOnStatusError?: boolean;
  validate?: ValidateSide;
};

/** Parameter bag for an endpoint + request options. */
export type ApiCallParams<TEndpoint> = TEndpoint extends { parameters: infer UParams }
  ? NotNever<InferSchemaInput<UParams>> extends true
    ? InferSchemaInput<UParams> & ApiRequestOptions
    : ApiRequestOptions
  : ApiRequestOptions;

/** Resolve response type from withResponse flag on the call config. */
export type ApiCallResult<TEndpoint, TParams> = TParams extends { withResponse: true }
  ? SafeApiResponse<TEndpoint>
  : InferSuccessData<TEndpoint>;

export type ValidateSide = "none" | "input" | "output" | "both";
export type OnValidate = (ctx: {
  side: "input" | "output";
  method: string;
  path: string;
  schema: unknown;
  value: unknown;
}) => unknown | Promise<unknown>;

// </ApiClientTypes>

// <TypedStatusError>
export class TypedStatusError<TData = unknown> extends Error {
  response: TypedErrorResponse<TData, ErrorStatusCode, unknown>;
  status: number;
  constructor(response: TypedErrorResponse<TData, ErrorStatusCode, unknown>) {
    super(`HTTP ${response.status}: ${response.statusText}`);
    this.name = "TypedStatusError";
    this.response = response;
    this.status = response.status;
  }
}
// </TypedStatusError>

// <ValidateHelpers>
const defaultParse = (schema: unknown, value: unknown): unknown => {
  return (schema as { parse: (v: unknown) => unknown }).parse(value);
};

const runValidate = async (ctx: {
  side: "input" | "output";
  method: string;
  path: string;
  schema: unknown;
  value: unknown;
  onValidate?: OnValidate;
}): Promise<unknown> => {
  if (ctx.onValidate) return ctx.onValidate(ctx);
  return defaultParse(ctx.schema, ctx.value);
};
// </ValidateHelpers>

// <ApiClient>
const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

export class ApiClient {
  baseUrl: string = "";
  successStatusCodes = successStatusCodes;
  errorStatusCodes = errorStatusCodes;
  validate: ValidateSide = "both";
  onValidate?: OnValidate;

  constructor(
    public fetcher: Fetcher,
    options?: { validate?: ValidateSide; onValidate?: OnValidate },
  ) {
    if (options?.validate !== undefined) this.validate = options.validate;
    if (options?.onValidate) this.onValidate = options.onValidate;
  }

  setBaseUrl(baseUrl: string) {
    this.baseUrl = baseUrl;
    return this;
  }

  setValidate(validate: ValidateSide) {
    this.validate = validate;
    return this;
  }

  setOnValidate(onValidate: OnValidate | undefined) {
    if (onValidate === undefined) {
      delete this.onValidate;
    } else {
      this.onValidate = onValidate;
    }
    return this;
  }

  /**
   * Replace path parameters in URL
   * Supports both OpenAPI format {param} and Express format :param
   */
  defaultDecodePathParams = (url: string, params: unknown, styles?: Record<string, ParameterSerialization>): string => {
    const record = (params ?? {}) as Record<string, unknown>;
    const encode = (value: unknown) => encodeURIComponent(String(value));
    const serialize = (key: string, value: unknown): string => {
      const parameterStyle = styles?.[key];
      const style = parameterStyle?.style ?? "simple";
      const explode = parameterStyle?.explode ?? false;
      if (style === "label") {
        if (Array.isArray(value))
          return (
            "." +
            value
              .filter((item) => item != null)
              .map(encode)
              .join(explode ? "." : ",")
          );
        if (isPlainObject(value)) {
          const entries = Object.entries(value as Record<string, unknown>).filter(([, item]) => item != null);
          return (
            "." +
            (explode
              ? entries.map(([name, item]) => encode(name) + "=" + encode(item)).join(".")
              : entries.flatMap(([name, item]) => [encode(name), encode(item)]).join(","))
          );
        }
        return "." + encode(value);
      }
      if (style === "matrix") {
        if (Array.isArray(value))
          return explode
            ? value
                .filter((item) => item != null)
                .map((item) => ";" + key + "=" + encode(item))
                .join("")
            : ";" +
                key +
                "=" +
                value
                  .filter((item) => item != null)
                  .map(encode)
                  .join(",");
        if (isPlainObject(value)) {
          const entries = Object.entries(value as Record<string, unknown>).filter(([, item]) => item != null);
          return explode
            ? entries.map(([name, item]) => ";" + encode(name) + "=" + encode(item)).join("")
            : ";" + key + "=" + entries.flatMap(([name, item]) => [encode(name), encode(item)]).join(",");
        }
        return ";" + key + "=" + encode(value);
      }
      if (Array.isArray(value))
        return value
          .filter((item) => item != null)
          .map(encode)
          .join(",");
      if (isPlainObject(value)) {
        return Object.entries(value as Record<string, unknown>)
          .filter(([, item]) => item != null)
          .map(([name, item]) => (explode ? encode(name) + "=" + encode(item) : [encode(name), encode(item)]))
          .flat()
          .join(",");
      }
      return encode(value);
    };
    return url
      .replace(/{([^}]+)}/g, (_, key: string) => (record[key] != null ? serialize(key, record[key]) : `{${key}}`))
      .replace(/:([a-zA-Z0-9_]+)/g, (_, key: string) =>
        record[key] != null ? serialize(key, record[key]) : `:${key}`,
      );
  };

  /** Uses URLSearchParams, skips null/undefined values */
  defaultEncodeSearchParams = (
    queryParams: unknown,
    styles?: Record<string, ParameterSerialization>,
  ): URLSearchParams | undefined => {
    if (!queryParams || typeof queryParams !== "object") return;

    const searchParams = new URLSearchParams();
    const rawEntries: Array<{ key: string; value: string; allowReserved: boolean }> = [];
    const append = (key: string, value: unknown, allowReserved = false) => {
      const stringValue = String(value);
      searchParams.append(key, stringValue);
      rawEntries.push({ key, value: stringValue, allowReserved });
    };
    const encodeQueryComponent = (value: string, allowReserved: boolean) => {
      const encoded = encodeURIComponent(value);
      return allowReserved
        ? encoded.replace(/%3A|%2F|%3F|%40|%21|%24|%26|%27|%28|%29|%2A|%2B|%2C|%3B|%3D|%5B|%5D/gi, (part) =>
            decodeURIComponent(part),
          )
        : encoded;
    };
    Object.defineProperty(searchParams, "toString", {
      value: () =>
        rawEntries
          .map(
            ({ key, value, allowReserved }) =>
              `${encodeQueryComponent(key, false)}=${encodeQueryComponent(value, allowReserved)}`,
          )
          .join("&"),
    });
    Object.entries(queryParams as Record<string, unknown>).forEach(([key, value]) => {
      if (value != null) {
        // Skip null/undefined values
        const parameterStyle = styles?.[key];
        const style = parameterStyle?.style ?? "form";
        const explode = parameterStyle?.explode ?? true;
        const allowReserved = parameterStyle?.allowReserved === true;
        if (Array.isArray(value)) {
          if (style === "spaceDelimited")
            append(
              key,
              value
                .filter((item) => item != null)
                .map(String)
                .join(" "),
              allowReserved,
            );
          else if (style === "pipeDelimited")
            append(
              key,
              value
                .filter((item) => item != null)
                .map(String)
                .join("|"),
              allowReserved,
            );
          else if (explode) value.forEach((val) => val != null && append(key, val, allowReserved));
          else
            append(
              key,
              value
                .filter((item) => item != null)
                .map(String)
                .join(","),
              allowReserved,
            );
        } else if (isPlainObject(value)) {
          const entries = Object.entries(value as Record<string, unknown>).filter(
            ([, nestedValue]) => nestedValue != null,
          );
          if (style === "deepObject") {
            for (const [nestedKey, nestedValue] of entries) {
              if (Array.isArray(nestedValue))
                nestedValue.forEach((item) => item != null && append(`${key}[${nestedKey}]`, item, allowReserved));
              else append(`${key}[${nestedKey}]`, nestedValue, allowReserved);
            }
          } else if (explode) {
            for (const [nestedKey, nestedValue] of entries) {
              if (Array.isArray(nestedValue))
                nestedValue.forEach((item) => item != null && append(nestedKey, item, allowReserved));
              else append(nestedKey, nestedValue, allowReserved);
            }
          } else {
            append(
              key,
              entries
                .flatMap(([nestedKey, nestedValue]) => [
                  nestedKey,
                  ...(Array.isArray(nestedValue) ? nestedValue : [nestedValue]),
                ])
                .map(String)
                .join(","),
              allowReserved,
            );
          }
        } else {
          append(key, value, allowReserved);
        }
      }
    });

    return searchParams;
  };

  /** Append cookie params as a Cookie header (or merge into existing). */
  defaultEncodeCookies = (cookies: unknown, headers: Headers): void => {
    if (!cookies || typeof cookies !== "object") return;
    const parts = Object.entries(cookies as Record<string, unknown>)
      .filter(([, value]) => value != null)
      .map(([key, value]) => `${key}=${String(value)}`);
    if (!parts.length) return;
    const existing = headers.get("cookie");
    headers.set("cookie", existing ? `${existing}; ${parts.join("; ")}` : parts.join("; "));
  };

  defaultParseResponseData = async (response: FetcherResponse): Promise<unknown> => {
    const contentType = response.headers.get("content-type") ?? "";
    const normalizedContentType = contentType.toLowerCase();
    if (normalizedContentType.includes("text/event-stream")) {
      return response.body ?? null;
    }
    if (normalizedContentType.startsWith("text/")) {
      return await response.text();
    }

    if (normalizedContentType.startsWith("application/octet-stream")) {
      return new Blob([await response.arrayBuffer()]);
    }

    if (
      normalizedContentType.includes("application/json") ||
      (normalizedContentType.includes("application/") && normalizedContentType.includes("json")) ||
      normalizedContentType === "*/*"
    ) {
      try {
        return await response.json();
      } catch {
        return undefined;
      }
    }

    return;
  };

  // <ApiClient.post>
  post<Path extends keyof PostEndpoints, TEndpoint extends PostEndpoints[Path]>(
    path: Path,
    ...params: MaybeOptionalArg<
      TEndpoint extends { parameters: infer UParams }
        ? NotNever<InferSchemaInput<UParams>> extends true
          ? InferSchemaInput<UParams> & {
              overrides?: RequestInit;
              queryOptions?: ApiQueryOptions;
              withResponse: true;
              throwOnStatusError?: boolean;
              validate?: ValidateSide;
            }
          : {
              overrides?: RequestInit;
              queryOptions?: ApiQueryOptions;
              withResponse: true;
              throwOnStatusError?: boolean;
              validate?: ValidateSide;
            }
        : {
            overrides?: RequestInit;
            queryOptions?: ApiQueryOptions;
            withResponse: true;
            throwOnStatusError?: boolean;
            validate?: ValidateSide;
          }
    >
  ): Promise<SafeApiResponse<TEndpoint>>;

  post<Path extends keyof PostEndpoints, TEndpoint extends PostEndpoints[Path]>(
    path: Path,
    ...params: MaybeOptionalArg<
      TEndpoint extends { parameters: infer UParams }
        ? NotNever<InferSchemaInput<UParams>> extends true
          ? InferSchemaInput<UParams> & {
              overrides?: RequestInit;
              queryOptions?: ApiQueryOptions;
              withResponse?: false;
              throwOnStatusError?: boolean;
              validate?: ValidateSide;
            }
          : {
              overrides?: RequestInit;
              queryOptions?: ApiQueryOptions;
              withResponse?: false;
              throwOnStatusError?: boolean;
              validate?: ValidateSide;
            }
        : {
            overrides?: RequestInit;
            queryOptions?: ApiQueryOptions;
            withResponse?: false;
            throwOnStatusError?: boolean;
            validate?: ValidateSide;
          }
    >
  ): Promise<InferSuccessData<TEndpoint>>;

  post<Path extends keyof PostEndpoints>(path: Path, ...params: [config?: unknown]): Promise<unknown> {
    return this.request("post", path, params[0] as never) as Promise<unknown>;
  }
  // </ApiClient.post>

  // <ApiClient.patch>
  patch<Path extends keyof PatchEndpoints, TEndpoint extends PatchEndpoints[Path]>(
    path: Path,
    ...params: MaybeOptionalArg<
      TEndpoint extends { parameters: infer UParams }
        ? NotNever<InferSchemaInput<UParams>> extends true
          ? InferSchemaInput<UParams> & {
              overrides?: RequestInit;
              queryOptions?: ApiQueryOptions;
              withResponse: true;
              throwOnStatusError?: boolean;
              validate?: ValidateSide;
            }
          : {
              overrides?: RequestInit;
              queryOptions?: ApiQueryOptions;
              withResponse: true;
              throwOnStatusError?: boolean;
              validate?: ValidateSide;
            }
        : {
            overrides?: RequestInit;
            queryOptions?: ApiQueryOptions;
            withResponse: true;
            throwOnStatusError?: boolean;
            validate?: ValidateSide;
          }
    >
  ): Promise<SafeApiResponse<TEndpoint>>;

  patch<Path extends keyof PatchEndpoints, TEndpoint extends PatchEndpoints[Path]>(
    path: Path,
    ...params: MaybeOptionalArg<
      TEndpoint extends { parameters: infer UParams }
        ? NotNever<InferSchemaInput<UParams>> extends true
          ? InferSchemaInput<UParams> & {
              overrides?: RequestInit;
              queryOptions?: ApiQueryOptions;
              withResponse?: false;
              throwOnStatusError?: boolean;
              validate?: ValidateSide;
            }
          : {
              overrides?: RequestInit;
              queryOptions?: ApiQueryOptions;
              withResponse?: false;
              throwOnStatusError?: boolean;
              validate?: ValidateSide;
            }
        : {
            overrides?: RequestInit;
            queryOptions?: ApiQueryOptions;
            withResponse?: false;
            throwOnStatusError?: boolean;
            validate?: ValidateSide;
          }
    >
  ): Promise<InferSuccessData<TEndpoint>>;

  patch<Path extends keyof PatchEndpoints>(path: Path, ...params: [config?: unknown]): Promise<unknown> {
    return this.request("patch", path, params[0] as never) as Promise<unknown>;
  }
  // </ApiClient.patch>

  // <ApiClient.delete>
  delete<Path extends keyof DeleteEndpoints, TEndpoint extends DeleteEndpoints[Path]>(
    path: Path,
    ...params: MaybeOptionalArg<
      TEndpoint extends { parameters: infer UParams }
        ? NotNever<InferSchemaInput<UParams>> extends true
          ? InferSchemaInput<UParams> & {
              overrides?: RequestInit;
              queryOptions?: ApiQueryOptions;
              withResponse: true;
              throwOnStatusError?: boolean;
              validate?: ValidateSide;
            }
          : {
              overrides?: RequestInit;
              queryOptions?: ApiQueryOptions;
              withResponse: true;
              throwOnStatusError?: boolean;
              validate?: ValidateSide;
            }
        : {
            overrides?: RequestInit;
            queryOptions?: ApiQueryOptions;
            withResponse: true;
            throwOnStatusError?: boolean;
            validate?: ValidateSide;
          }
    >
  ): Promise<SafeApiResponse<TEndpoint>>;

  delete<Path extends keyof DeleteEndpoints, TEndpoint extends DeleteEndpoints[Path]>(
    path: Path,
    ...params: MaybeOptionalArg<
      TEndpoint extends { parameters: infer UParams }
        ? NotNever<InferSchemaInput<UParams>> extends true
          ? InferSchemaInput<UParams> & {
              overrides?: RequestInit;
              queryOptions?: ApiQueryOptions;
              withResponse?: false;
              throwOnStatusError?: boolean;
              validate?: ValidateSide;
            }
          : {
              overrides?: RequestInit;
              queryOptions?: ApiQueryOptions;
              withResponse?: false;
              throwOnStatusError?: boolean;
              validate?: ValidateSide;
            }
        : {
            overrides?: RequestInit;
            queryOptions?: ApiQueryOptions;
            withResponse?: false;
            throwOnStatusError?: boolean;
            validate?: ValidateSide;
          }
    >
  ): Promise<InferSuccessData<TEndpoint>>;

  delete<Path extends keyof DeleteEndpoints>(path: Path, ...params: [config?: unknown]): Promise<unknown> {
    return this.request("delete", path, params[0] as never) as Promise<unknown>;
  }
  // </ApiClient.delete>

  // <ApiClient.get>
  get<Path extends keyof GetEndpoints, TEndpoint extends GetEndpoints[Path]>(
    path: Path,
    ...params: MaybeOptionalArg<
      TEndpoint extends { parameters: infer UParams }
        ? NotNever<InferSchemaInput<UParams>> extends true
          ? InferSchemaInput<UParams> & {
              overrides?: RequestInit;
              queryOptions?: ApiQueryOptions;
              withResponse: true;
              throwOnStatusError?: boolean;
              validate?: ValidateSide;
            }
          : {
              overrides?: RequestInit;
              queryOptions?: ApiQueryOptions;
              withResponse: true;
              throwOnStatusError?: boolean;
              validate?: ValidateSide;
            }
        : {
            overrides?: RequestInit;
            queryOptions?: ApiQueryOptions;
            withResponse: true;
            throwOnStatusError?: boolean;
            validate?: ValidateSide;
          }
    >
  ): Promise<SafeApiResponse<TEndpoint>>;

  get<Path extends keyof GetEndpoints, TEndpoint extends GetEndpoints[Path]>(
    path: Path,
    ...params: MaybeOptionalArg<
      TEndpoint extends { parameters: infer UParams }
        ? NotNever<InferSchemaInput<UParams>> extends true
          ? InferSchemaInput<UParams> & {
              overrides?: RequestInit;
              queryOptions?: ApiQueryOptions;
              withResponse?: false;
              throwOnStatusError?: boolean;
              validate?: ValidateSide;
            }
          : {
              overrides?: RequestInit;
              queryOptions?: ApiQueryOptions;
              withResponse?: false;
              throwOnStatusError?: boolean;
              validate?: ValidateSide;
            }
        : {
            overrides?: RequestInit;
            queryOptions?: ApiQueryOptions;
            withResponse?: false;
            throwOnStatusError?: boolean;
            validate?: ValidateSide;
          }
    >
  ): Promise<InferSuccessData<TEndpoint>>;

  get<Path extends keyof GetEndpoints>(path: Path, ...params: [config?: unknown]): Promise<unknown> {
    return this.request("get", path, params[0] as never) as Promise<unknown>;
  }
  // </ApiClient.get>

  // <ApiClient.request>
  /**
   * Generic request method with full type-safety for any endpoint
   */
  request<
    TMethod extends keyof EndpointByMethod,
    TPath extends keyof EndpointByMethod[TMethod],
    TEndpoint extends EndpointByMethod[TMethod][TPath],
  >(
    method: TMethod,
    path: TPath,
    ...params: MaybeOptionalArg<
      TEndpoint extends { parameters: infer UParams }
        ? NotNever<InferSchemaInput<UParams>> extends true
          ? InferSchemaInput<UParams> & {
              overrides?: RequestInit;
              queryOptions?: ApiQueryOptions;
              withResponse: true;
              throwOnStatusError?: boolean;
              validate?: ValidateSide;
            }
          : {
              overrides?: RequestInit;
              queryOptions?: ApiQueryOptions;
              withResponse: true;
              throwOnStatusError?: boolean;
              validate?: ValidateSide;
            }
        : {
            overrides?: RequestInit;
            queryOptions?: ApiQueryOptions;
            withResponse: true;
            throwOnStatusError?: boolean;
            validate?: ValidateSide;
          }
    >
  ): Promise<SafeApiResponse<TEndpoint>>;

  request<
    TMethod extends keyof EndpointByMethod,
    TPath extends keyof EndpointByMethod[TMethod],
    TEndpoint extends EndpointByMethod[TMethod][TPath],
  >(
    method: TMethod,
    path: TPath,
    ...params: MaybeOptionalArg<
      TEndpoint extends { parameters: infer UParams }
        ? NotNever<InferSchemaInput<UParams>> extends true
          ? InferSchemaInput<UParams> & {
              overrides?: RequestInit;
              queryOptions?: ApiQueryOptions;
              withResponse?: false;
              throwOnStatusError?: boolean;
              validate?: ValidateSide;
            }
          : {
              overrides?: RequestInit;
              queryOptions?: ApiQueryOptions;
              withResponse?: false;
              throwOnStatusError?: boolean;
              validate?: ValidateSide;
            }
        : {
            overrides?: RequestInit;
            queryOptions?: ApiQueryOptions;
            withResponse?: false;
            throwOnStatusError?: boolean;
            validate?: ValidateSide;
          }
    >
  ): Promise<InferSuccessData<TEndpoint>>;

  request<
    TMethod extends keyof EndpointByMethod,
    TPath extends keyof EndpointByMethod[TMethod],
    TEndpoint extends EndpointByMethod[TMethod][TPath],
  >(method: TMethod, path: TPath, ...params: [config?: unknown]): Promise<unknown> {
    return (async () => {
      const requestParams = params[0] as
        | (EndpointParameters & {
            overrides?: RequestInit;
            queryOptions?: ApiQueryOptions;
            withResponse?: boolean;
            throwOnStatusError?: boolean;
            validate?: ValidateSide;
          })
        | undefined;
      const withResponse = requestParams?.withResponse;
      const throwOnStatusError = requestParams?.throwOnStatusError ?? (withResponse ? false : true);
      let overrides = requestParams?.overrides;
      const validateSide: ValidateSide = requestParams?.validate ?? this.validate;

      const parametersToSend: EndpointParameters = {};
      if (requestParams?.body !== undefined) parametersToSend.body = requestParams.body;
      if (requestParams?.query !== undefined) parametersToSend.query = requestParams.query;
      if (requestParams?.header !== undefined) parametersToSend.header = requestParams.header;
      if (requestParams?.path !== undefined) parametersToSend.path = requestParams.path;
      if (requestParams?.cookie !== undefined) parametersToSend.cookie = requestParams.cookie;

      type RuntimeEndpoint = {
        parameters?: Partial<Record<"body" | "query" | "header" | "path" | "cookie", unknown>>;
        responses?: Record<string, unknown>;
      };
      const endpointSchema = EndpointByMethod[method][path] as RuntimeEndpoint;
      const shouldValidateInput = validateSide === "input" || validateSide === "both";
      if (shouldValidateInput && endpointSchema.parameters) {
        const paramSchema = endpointSchema.parameters;
        for (const key of ["body", "query", "header", "path", "cookie"] as const) {
          const schema = paramSchema[key];
          const value = parametersToSend[key];
          if (schema !== undefined && value !== undefined) {
            parametersToSend[key] = await runValidate({
              side: "input",
              method: String(method),
              path: String(path),
              schema,
              value,
              ...(this.onValidate ? { onValidate: this.onValidate } : {}),
            });
          }
        }
      }

      const resolvedPath = (this.fetcher.decodePathParams ?? this.defaultDecodePathParams)(
        this.baseUrl + (path as string),
        parametersToSend.path ?? {},
        endpointParameterStyles[method]?.[path]?.path,
      );
      const url = new URL(resolvedPath);
      const urlSearchParams = (this.fetcher.encodeSearchParams ?? this.defaultEncodeSearchParams)(
        parametersToSend.query,
        endpointParameterStyles[method]?.[path]?.query,
      );

      if (parametersToSend.cookie) {
        const headers = new Headers((overrides as RequestInit | undefined)?.headers);
        (this.fetcher.encodeCookies ?? this.defaultEncodeCookies)(parametersToSend.cookie, headers);
        overrides = { ...overrides, headers };
      }

      const parameterStyles = endpointParameterStyles[method]?.[path as string];
      const response = await this.fetcher.fetch({
        method: method,
        path: path as string,
        url,
        ...(urlSearchParams ? { urlSearchParams } : {}),
        ...(Object.keys(parametersToSend).length ? { parameters: parametersToSend } : {}),
        requestFormat: endpointRequestFormats[method]?.[path] ?? "json",
        ...(parameterStyles ? { parameterStyles } : {}),
        security: endpointSecurityRequirements[method]?.[path] ?? defaultSecurityRequirements,
        ...(overrides ? { overrides } : {}),
        throwOnStatusError,
      });
      const responseFormat = endpointResponseFormats[method]?.[path] ?? "json";
      let data =
        responseFormat === "sse"
          ? (response.body ?? null)
          : await (this.fetcher.parseResponseData ?? this.defaultParseResponseData)(response);
      const shouldValidateOutput = validateSide === "output" || validateSide === "both";
      if (
        shouldValidateOutput &&
        responseFormat !== "sse" &&
        (response.ok || !(errorStatusCodes as readonly number[]).includes(response.status)) &&
        endpointSchema?.responses
      ) {
        const responseSchema =
          endpointSchema.responses[String(response.status)] ??
          endpointSchema.responses[String(Math.floor(response.status / 100)) + "xx"] ??
          endpointSchema.responses[String(Math.floor(response.status / 100)) + "XX"] ??
          endpointSchema.responses["default"];
        if (responseSchema) {
          data = await runValidate({
            side: "output",
            method: String(method),
            path: String(path),
            schema: responseSchema,
            value: data,
            ...(this.onValidate ? { onValidate: this.onValidate } : {}),
          });
        }
      }
      const typedResponse = Object.assign(response, {
        data: data,
        json: () => Promise.resolve(data),
      }) as SafeApiResponse<TEndpoint>;

      if (throwOnStatusError && (errorStatusCodes as readonly number[]).includes(response.status)) {
        throw new TypedStatusError(typedResponse as TypedErrorResponse<unknown, ErrorStatusCode, unknown>);
      }

      return withResponse ? typedResponse : data;
    })();
  }
  // </ApiClient.request>
}

export function createApiClient(
  fetcher: Fetcher,
  baseUrl?: string,
  options?: { validate?: ValidateSide; onValidate?: OnValidate },
) {
  return new ApiClient(fetcher, options).setBaseUrl(baseUrl ?? "");
}

/**
 Example usage:
 const api = createApiClient((method, url, params) =>
   fetch(url, { method, body: JSON.stringify(params) }).then((res) => res.json()),
 );
 api.get("/users").then((users) => console.log(users));
 api.post("/users", { body: { name: "John" } }).then((user) => console.log(user));
 api.put("/users/:id", { path: { id: 1 }, body: { name: "John" } }).then((user) => console.log(user));

 // With error handling
 const result = await api.get("/users/{id}", { path: { id: "123" }, withResponse: true });
 if (result.ok) {
   // Access data directly
   const user = result.data;
   console.log(user);

   // Or use the json() method for compatibility
   const userFromJson = await result.json();
   console.log(userFromJson);
 } else {
   const error = result.data;
   console.error(`Error ${result.status}:`, error);
 }
*/

// </ApiClient>

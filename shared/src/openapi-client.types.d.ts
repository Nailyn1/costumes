export namespace Schemas {
  // <Schemas>
  export type Auth_LoginRequest = { login: string; password: string } & Record<string, unknown>;
  export type Auth_LoginSuccessResponse = {
    accessToken: string;
    user: { login: string; name: string } & Record<string, unknown>;
  } & Record<string, unknown>;
  export type Auth_RefreshSuccessResponse = { accessToken: string } & Record<string, unknown>;
  export type Children_Child = { childId: number; name: string } & Record<string, unknown>;
  export type Children_ChildName = string;
  export type Children_ChildResponse = { childId: number; name: Children_ChildName; clientId: number } & Record<
    string,
    unknown
  >;
  export type Children_ChildUpdateResponse = { childId: number; name: Children_ChildName } & Record<string, unknown>;
  export type Children_CreateChildRequest = { clientId: number; name: Children_ChildName } & Record<string, unknown>;
  export type Children_UpdateChildRequest = Partial<{ name: Children_ChildName }> & Record<string, unknown>;
  export type Clients_ClientName = string;
  export type Clients_PhoneString = string;
  export type Clients_Client = {
    clientId: number;
    name: Clients_ClientName;
    phone: Clients_PhoneString;
    children?: Array<Children_Child>;
    isBlacklisted: boolean;
    blacklistReason?: string;
    /**
     * A delivered, read, or confirmed message proves WhatsApp on the current phone.
     */
    whatsappConfirmed: boolean;
  } & Record<string, unknown>;
  export type Clients_ClientItem = {
    clientId: number;
    name: Clients_ClientName;
    phone: Clients_PhoneString;
    isBlacklisted: boolean;
  } & Record<string, unknown>;
  export type Visits_OrderStatus = "reserved" | "issued" | "returned" | "cancelled";
  export type Clients_ClientOrderHistory = {
    orderId: number;
    costumeName: string;
    inventoryCode: string;
    childName: string;
    orderStatus: Visits_OrderStatus;
    rentPrice: number;
    prepaymentAmount: number;
    finalPayment?: number;
  } & Record<string, unknown>;
  export type Costumes_VisitCode = string;
  export type Visits_VisitStatus = "reserved" | "issued" | "completed" | "cancelled";
  export type Visits_TimeString = string;
  export type Clients_ClientVisitHistory = {
    visitId: number;
    visitCode: Costumes_VisitCode;
    visitStatus: Visits_VisitStatus;
    createdAt: string;
    startDateTime: string;
    endDateTime: string;
    issueTimeFrom: Visits_TimeString;
    returnTimeUntil: Visits_TimeString;
    visitNote?: string;
    orders: Array<Clients_ClientOrderHistory>;
  } & Record<string, unknown>;
  export type Clients_CreateClientRequest = { name: Clients_ClientName; phone: Clients_PhoneString } & Record<
    string,
    unknown
  >;
  export type Clients_GetClientDetailed = {
    client: Clients_Client;
    visits: Array<Clients_ClientVisitHistory>;
  } & Record<string, unknown>;
  export type Clients_GetClientList = {
    items: Array<Clients_ClientItem>;
    totalOrders: number;
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  } & Record<string, unknown>;
  export type Clients_UpdateClientRequest = Partial<{ name: Clients_ClientName; phone: Clients_PhoneString }> &
    Record<string, unknown>;
  export type Clients_WhatsappAvailability = { status: "exists" | "absent" | "unknown" } & Record<string, unknown>;
  export type Clients_blacklistReason = Partial<{ blacklistReason: string }> & Record<string, unknown>;
  export type Common_Error = {
    statusCode: number;
    message: string;
    error?: string;
    code?: string;
    fieldErrors?: Record<string, Array<string>>;
  } & Record<string, unknown>;
  export type Costumes_AvailabilityPeriod = {
    visitCode: Costumes_VisitCode;
    clientName: string;
    childName: string;
    clientPhone: string;
    startDateTime: string;
    endDateTime: string;
    issueTimeFrom: Visits_TimeString;
    returnTimeUntil: Visits_TimeString;
  } & Record<string, unknown>;
  export type Costumes_InventoryCode = string;
  export type Costumes_CostumeStatus = "available" | "issued";
  export type Costumes_AvailableCostume = {
    costumeId: number;
    name: string;
    inventoryCode: Costumes_InventoryCode;
    status: Costumes_CostumeStatus;
  } & Record<string, unknown>;
  export type Costumes_Costume = { costumeId: number; name: string; inventoryCode: Costumes_InventoryCode } & Record<
    string,
    unknown
  >;
  export type Costumes_CostumeFullAvailability = {
    costumeId: number;
    name: string;
    inventoryCode: Costumes_InventoryCode;
    periods: Array<Costumes_AvailabilityPeriod>;
    noPeriodsMessage: string | null;
  } & Record<string, unknown>;
  export type Costumes_CostumeSearchResult = {
    costumeId: number;
    name: string;
    inventoryCode: Costumes_InventoryCode;
    display: string;
  } & Record<string, unknown>;
  export type Costumes_CreateCostumeRequest = { name: string } & Record<string, unknown>;
  export type Costumes_GetCostumesList = {
    items: Array<Costumes_Costume>;
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  } & Record<string, unknown>;
  export type Costumes_UpdateCostumeRequest = Partial<{ name: string }> & Record<string, unknown>;
  export type Visits_VisitSettlementRequest = { kind: "debt_payment" | "customer_refund"; amount: number } & Record<
    string,
    unknown
  >;
  export type Visits_CompleteReturnRequest = {
    depositReturned: boolean;
    notes?: string;
    settlement?: Visits_VisitSettlementRequest;
  } & Record<string, unknown>;
  export type Visits_VisitBalance = {
    totalRent: number;
    totalPrepayment: number;
    totalReceived: number;
    totalRefunded: number;
    /**
     * Положительное значение — долг, отрицательное — сумма к возврату клиенту
     */
    signedBalance: number;
    debt: number;
    refundDue: number;
  } & Record<string, unknown>;
  export type Visits_CompleteReturnResponse = {
    visitId: number;
    visitCode: Costumes_VisitCode;
    status: Visits_VisitStatus;
    message: string;
    balance: Visits_VisitBalance;
  } & Record<string, unknown>;
  export type Visits_CreateVisitRequest = {
    clientId: number;
    visitCode: Costumes_VisitCode;
    startDateTime: string;
    issueTimeFrom: Visits_TimeString;
    issueTimeTo: Visits_TimeString;
    endDateTime: string;
    returnTimeUntil: Visits_TimeString;
    notes?: string;
    orders: Array<
      { childId: number; costumeId: number; rentPrice: number; prepaymentAmount: number; notes?: string } & Record<
        string,
        unknown
      >
    >;
  } & Record<string, unknown>;
  export type Visits_DepositType = "cash" | "document" | "none";
  export type Visits_DepositReturnedHistoryPayload = {
    kind: "deposit.returned";
    depositType: Visits_DepositType;
    amount: number;
  } & Record<string, unknown>;
  export type Visits_VisitDepositInfo = { type: Visits_DepositType; amount?: number } & Record<string, unknown>;
  export type Visits_GetIssuedItem = {
    visitId: number;
    visitCode: Costumes_VisitCode;
    clientName: Clients_ClientName;
    clientPhone: Clients_PhoneString;
    startDateTime: string;
    endDateTime: string;
    childrenNames: string;
    costumesNames: string;
    deposit: Visits_VisitDepositInfo;
  } & Record<string, unknown>;
  export type Visits_GetIssuedResponse = {
    items: Array<Visits_GetIssuedItem>;
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  } & Record<string, unknown>;
  export type Visits_NotificationItem = {
    notificationId: number;
    status: "pending" | "sent" | "delivered" | "failed" | "isConfirmed" | "read" | "noAccount";
    visitCode: Costumes_VisitCode;
    clientName: Clients_ClientName;
    clientPhone: Clients_PhoneString;
    childrenNames: string;
    costumeNames: string;
    message: string;
  } & Record<string, unknown>;
  export type Visits_GetNotificationResponse = {
    items: Array<Visits_NotificationItem>;
    totalToday: number;
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  } & Record<string, unknown>;
  export type Visits_GetReservedResponse = {
    visitId: number;
    visitCode: Costumes_VisitCode;
    clientName: Clients_ClientName;
    childrenNames: string;
    costumesNames: string;
    clientPhone: Clients_PhoneString;
  } & Record<string, unknown>;
  export type Visits_GetUnreturnedResponse = {
    visitId: number;
    visitCode: Costumes_VisitCode;
    childrenNames: string;
    costumeNames: string;
    startDateTime: string;
    endDateTime: string;
    clientPhone: Clients_PhoneString;
    clientName: Clients_ClientName;
    deposit: Visits_VisitDepositInfo;
    notes: string;
  } & Record<string, unknown>;
  export type Visits_GetUnreturnedDepositsResponse = {
    items: Array<Visits_GetUnreturnedResponse>;
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  } & Record<string, unknown>;
  export type Visits_IssueVisitRequest = {
    additionalPayment: number;
    deposit: { type: Visits_DepositType; amount?: number } & Record<string, unknown>;
    notes?: string;
  } & Record<string, unknown>;
  export type Visits_IssuedForReturnResponse = {
    visitId: number;
    visitCode: Costumes_VisitCode;
    clientName: Clients_ClientName;
    childrenNames: string;
    costumeNames: string;
    endDateTime: string;
    clientPhone: Clients_PhoneString;
    notes: string;
  } & Record<string, unknown>;
  export type Visits_MarkDepositReturnedResponse = {
    visitId: number;
    depositReturned: boolean;
    message: string;
  } & Record<string, unknown>;
  export type Visits_MoneyReceivedHistoryPayload = {
    kind: "money.received";
    moneyKind: "issue_payment" | "debt_payment";
    amount: number;
  } & Record<string, unknown>;
  export type Visits_MoneyRefundedHistoryPayload = { kind: "money.refunded"; amount: number } & Record<string, unknown>;
  export type Visits_Order = {
    orderId: number;
    inventoryCode: Costumes_InventoryCode;
    costumeName: string;
    visitCode: Costumes_VisitCode;
    childName: Children_ChildName;
    clientPhone: Clients_PhoneString;
    startDateTime: string;
    endDateTime: string;
    issueTimeFrom: Visits_TimeString;
    issueTimeTo: Visits_TimeString;
    returnTimeUntil: Visits_TimeString;
    rentPrice: number;
    prepaymentAmount: number;
    notes: string;
  } & Record<string, unknown>;
  export type Visits_NotWrittenOrdersResponse = { items: Array<Visits_Order>; message?: string } & Record<
    string,
    unknown
  >;
  export type Visits_Notification = {
    id: number;
    type: string;
    status: "pending" | "sent" | "delivered" | "failed" | "read";
    createdAt: string;
  } & Record<string, unknown>;
  export type Visits_PaginatedReservedResponse = {
    items: Array<Visits_GetReservedResponse>;
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  } & Record<string, unknown>;
  export type Visits_UnsettledVisitBalance = {
    visitId: number;
    visitCode: Costumes_VisitCode;
    clientName: Clients_ClientName;
    clientPhone: Clients_PhoneString;
    balance: Visits_VisitBalance;
  } & Record<string, unknown>;
  export type Visits_PaginatedUnsettledVisitBalancesResponse = {
    items: Array<Visits_UnsettledVisitBalance>;
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  } & Record<string, unknown>;
  export type Visits_VisitHistorySource = "user" | "system" | "import";
  export type Visits_VisitHistoryAction =
    | "visit.created"
    | "tag.written"
    | "visit.issued"
    | "visit.unissued"
    | "visit.cancelled"
    | "visit.completed"
    | "deposit.returned"
    | "money.received"
    | "money.refunded";
  export type Visits_VisitHistoryOrderSnapshot = {
    orderId: number;
    childName: string;
    costumeName: string;
    inventoryCode: Costumes_InventoryCode;
    rentPrice: number;
    prepaymentAmount: number;
  } & Record<string, unknown>;
  export type Visits_VisitCreatedHistoryPayload = {
    kind: "visit.created";
    visitCode: Costumes_VisitCode;
    clientId: number;
    clientName: string;
    startDateTime: string;
    endDateTime: string;
    orders: Array<Visits_VisitHistoryOrderSnapshot>;
  } & Record<string, unknown>;
  export type Visits_TagWrittenHistoryPayload = {
    kind: "tag.written";
    orderId: number;
    childName: string;
    costumeName: string;
    inventoryCode: Costumes_InventoryCode;
  } & Record<string, unknown>;
  export type Visits_VisitIssuedHistoryPayload = {
    kind: "visit.issued";
    visitCode: Costumes_VisitCode;
    additionalPayment: number;
    depositType: Visits_DepositType;
    depositAmount: number;
    orders: Array<Visits_VisitHistoryOrderSnapshot>;
  } & Record<string, unknown>;
  export type Visits_VisitUnissuedHistoryPayload = {
    kind: "visit.unissued";
    visitCode: Costumes_VisitCode;
    voidedPaymentAmount: number;
    depositType?: Visits_DepositType;
    depositAmount?: number;
    orders: Array<Visits_VisitHistoryOrderSnapshot>;
  } & Record<string, unknown>;
  export type Visits_VisitCancelledHistoryPayload = {
    kind: "visit.cancelled";
    visitCode: Costumes_VisitCode;
    reason?: string;
  } & Record<string, unknown>;
  export type Visits_VisitCompletedHistoryPayload = {
    kind: "visit.completed";
    visitCode: Costumes_VisitCode;
    orders: Array<Visits_VisitHistoryOrderSnapshot>;
    settlementKind?: "debt_payment" | "customer_refund";
    settlementAmount?: number;
  } & Record<string, unknown>;
  export type Visits_VisitHistoryPayload =
    | Visits_VisitCreatedHistoryPayload
    | Visits_TagWrittenHistoryPayload
    | Visits_VisitIssuedHistoryPayload
    | Visits_VisitUnissuedHistoryPayload
    | Visits_VisitCancelledHistoryPayload
    | Visits_VisitCompletedHistoryPayload
    | Visits_DepositReturnedHistoryPayload
    | Visits_MoneyReceivedHistoryPayload
    | Visits_MoneyRefundedHistoryPayload;
  export type Visits_VisitHistoryEvent = {
    id: number;
    occurredAt: string;
    actorUserId?: number;
    actorNameSnapshot: string;
    source: Visits_VisitHistorySource;
    action: Visits_VisitHistoryAction;
    entityType: "visit" | "order";
    entityId: number;
    visitId: number;
    orderId?: number;
    commandId: string;
    schemaVersion: 1;
    payload: Visits_VisitHistoryPayload;
  } & Record<string, unknown>;
  export type Visits_PaginatedVisitHistoryResponse = {
    items: Array<Visits_VisitHistoryEvent>;
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  } & Record<string, unknown>;
  export type Visits_VisitListItem = {
    id: number;
    visitCode: Costumes_VisitCode;
    status: Visits_VisitStatus;
    client: { id: number; name: Clients_ClientName; phone: Clients_PhoneString } & Record<string, unknown>;
    startDateTime: string;
    endDateTime: string;
    issueTimeFrom: Visits_TimeString;
    issueTimeTo: Visits_TimeString;
    returnTimeUntil: Visits_TimeString;
    childrenNames: string;
    costumesNames: string;
    orderCount: number;
    totalRent: number;
    totalPrepayment: number;
    totalRemaining: number;
    createdAt: string;
  } & Record<string, unknown>;
  export type Visits_PaginatedVisitsResponse = {
    items: Array<Visits_VisitListItem>;
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  } & Record<string, unknown>;
  export type Visits_TagStatus = "written" | "not_written";
  export type Visits_VisitOrder = {
    orderId: number;
    childName: Children_ChildName;
    costumeName: string;
    inventoryCode: Costumes_InventoryCode;
    rentPrice: number;
    prepaymentAmount: number;
    tagStatus: Visits_TagStatus;
  } & Record<string, unknown>;
  export type Visits_Visit = {
    id: number;
    visitCode: Costumes_VisitCode;
    status: Visits_VisitStatus;
    client: { id: number; fullname: Clients_ClientName; phone: Clients_PhoneString } & Record<string, unknown>;
    visitDate: {
      startDateTime: string;
      endDateTime: string;
      issueTimeFrom: Visits_TimeString;
      issueTimeTo: Visits_TimeString;
      returnTimeUntil: Visits_TimeString;
    } & Record<string, unknown>;
    notifications: Array<Visits_Notification>;
    orders: Array<Visits_VisitOrder>;
  } & Record<string, unknown>;
  /**
   * Запрос на отмену визита
   */
  export type Visits_VisitCancelRequest = Partial<{
    /**
     * Причина отмены визита
     */
    reason: string;
  }> &
    Record<string, unknown>;
  export type Visits_VisitForIssueResponse = {
    visitId: number;
    visitCode: Costumes_VisitCode;
    client: { name: Clients_ClientName; phone: Clients_PhoneString } & Record<string, unknown>;
    startDateTime: string;
    issueTimeFrom: Visits_TimeString;
    issueTimeTo: Visits_TimeString;
    returnTimeUntil: Visits_TimeString;
    endDateTime: string;
    totalRentPrice: number;
    totalPrepayment: number;
    remainingToPay: number;
    notes: string;
    orders: Array<Visits_VisitOrder>;
  } & Record<string, unknown>;
  export type Visits_VisitReturnOrder = {
    orderId: number;
    childName: Children_ChildName;
    costumeName: string;
    inventoryCode: Costumes_InventoryCode;
    rentPrice: number;
    prepaymentAmount: number;
    finalPayment: number;
    returned: boolean;
  } & Record<string, unknown>;
  export type Visits_VisitForReturnResponse = {
    visitId: number;
    visitCode: Costumes_VisitCode;
    client: { name: Clients_ClientName; phone: Clients_PhoneString } & Record<string, unknown>;
    startDateTime: string;
    endDateTime: string;
    notes: string;
    orders: Array<Visits_VisitReturnOrder>;
    deposit: Visits_VisitDepositInfo;
    balance: Visits_VisitBalance;
  } & Record<string, unknown>;
  export type Visits_VisitReadDeposit = {
    id: number;
    type: Visits_DepositType;
    amount?: number;
    returned: boolean;
    createdAt: string;
  } & Record<string, unknown>;
  export type Visits_VisitReadOrder = {
    orderId: number;
    childId: number;
    childName: Children_ChildName;
    costumeId: number;
    costumeName: string;
    inventoryCode: Costumes_InventoryCode;
    status: Visits_OrderStatus;
    tagStatus: Visits_TagStatus;
    rentPrice: number;
    prepaymentAmount: number;
    finalPayment?: number;
    notes?: string;
  } & Record<string, unknown>;
  export type Visits_VisitReadMoneyOperation = {
    id: number;
    kind: "issue_payment" | "debt_payment" | "customer_refund";
    amount: number;
    createdAt: string;
    voidedAt?: string;
    legacyImported: boolean;
  } & Record<string, unknown>;
  export type Visits_VisitReadTotals = { totalRent: number; totalPrepayment: number; totalRemaining: number } & Record<
    string,
    unknown
  >;
  export type Visits_VisitReadDetail = {
    id: number;
    visitCode: Costumes_VisitCode;
    status: Visits_VisitStatus;
    version: number;
    client: { id: number; name: Clients_ClientName; phone: Clients_PhoneString } & Record<string, unknown>;
    startDateTime: string;
    endDateTime: string;
    issueTimeFrom: Visits_TimeString;
    issueTimeTo: Visits_TimeString;
    returnTimeUntil: Visits_TimeString;
    notes?: string;
    createdAt: string;
    orders: Array<Visits_VisitReadOrder>;
    moneyOperations: Array<Visits_VisitReadMoneyOperation>;
    deposits: Array<Visits_VisitReadDeposit>;
    totals: Visits_VisitReadTotals;
    balance?: Visits_VisitBalance;
  } & Record<string, unknown>;
  export type Visits_VisitReturnSearchResponse = {
    visitId: number;
    visitCode: Costumes_VisitCode;
    childrenNames: string;
    costumesNames: string;
    returnDate: string;
    clientPhone: Clients_PhoneString;
    clientName: Clients_ClientName;
  } & Record<string, unknown>;
  export type Visits_VisitsSearchResponse = {
    visitId: number;
    visitCode: Costumes_VisitCode;
    clientName: Clients_ClientName;
    clientPhone: Clients_PhoneString;
    startDateTime: string;
    childrenNames: string;
    costumesNames: string;
  } & Record<string, unknown>;

  // </Schemas>
}

export namespace Endpoints {
  // <Endpoints>

  export type post_AuthOperations_login = {
    method: "POST";
    path: "/auth/login";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      body: Schemas.Auth_LoginRequest;
    };
    responses: { 201: Schemas.Auth_LoginSuccessResponse; default: Schemas.Common_Error };
    responseHeaders: { 201: { "Set-Cookie": string } };
  };
  export type post_AuthOperations_logout = {
    method: "POST";
    path: "/auth/logout";
    requestFormat: "json";
    responseFormat: "json";
    parameters: never;
    responses: { 204: unknown; default: Schemas.Common_Error };
    responseHeaders: { 204: { "Set-Cookie": string } };
  };
  export type post_AuthOperations_refresh = {
    method: "POST";
    path: "/auth/refresh";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      header: { Cookie: string };
    };
    responses: { 201: Schemas.Auth_RefreshSuccessResponse; default: Schemas.Common_Error };
  };
  export type post_ChildOperations_create = {
    method: "POST";
    path: "/children";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      body: Schemas.Children_CreateChildRequest;
    };
    responses: { 201: Schemas.Children_ChildResponse; default: Schemas.Common_Error };
  };
  export type patch_ChildOperations_update = {
    method: "PATCH";
    path: "/children/{childId}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { childId: number };

      body: Schemas.Children_UpdateChildRequest;
    };
    responses: { 200: Schemas.Children_ChildUpdateResponse; default: Schemas.Common_Error };
  };
  export type delete_ChildOperations_delete = {
    method: "DELETE";
    path: "/children/{childId}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { childId: number };
    };
    responses: { 204: unknown; default: Schemas.Common_Error };
  };
  export type post_ClientOperations_create = {
    method: "POST";
    path: "/clients";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      body: Schemas.Clients_CreateClientRequest;
    };
    responses: { 201: Schemas.Clients_Client; default: Schemas.Common_Error };
  };
  export type get_ClientOperations_getClientDetail = {
    method: "GET";
    path: "/clients/detail/{clientId}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { clientId: number };
    };
    responses: { 200: Schemas.Clients_GetClientDetailed; default: Schemas.Common_Error };
  };
  export type get_ClientOperations_getClientList = {
    method: "GET";
    path: "/clients/list";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      query?: Partial<{ page: number; limit: number }>;
    };
    responses: { 200: Schemas.Clients_GetClientList; default: Schemas.Common_Error };
  };
  export type get_ClientOperations_search = {
    method: "GET";
    path: "/clients/search";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      query: { q: string };
    };
    responses: { 200: Array<Schemas.Clients_Client>; default: Schemas.Common_Error };
  };
  export type patch_ClientOperations_update = {
    method: "PATCH";
    path: "/clients/{clientId}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { clientId: number };

      body: Schemas.Clients_UpdateClientRequest;
    };
    responses: { 200: Schemas.Clients_Client; default: Schemas.Common_Error };
  };
  export type delete_ClientOperations_delete = {
    method: "DELETE";
    path: "/clients/{clientId}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { clientId: number };
    };
    responses: { 204: unknown; default: Schemas.Common_Error };
  };
  export type post_ClientOperations_addClientInBlackList = {
    method: "POST";
    path: "/clients/{clientId}/blacklist";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { clientId: number };

      body: Schemas.Clients_blacklistReason;
    };
    responses: { 201: unknown; default: Schemas.Common_Error };
  };
  export type delete_ClientOperations_removeClientFromBlackList = {
    method: "DELETE";
    path: "/clients/{clientId}/blacklist";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { clientId: number };
    };
    responses: { 204: unknown; default: Schemas.Common_Error };
  };
  export type get_ClientOperations_checkWhatsappAvailability = {
    method: "GET";
    path: "/clients/{clientId}/whatsapp-availability";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      query?: Partial<{ force: boolean }>;
      path: { clientId: number };
    };
    responses: { 200: Schemas.Clients_WhatsappAvailability; default: Schemas.Common_Error };
  };
  export type post_CostumeOperations_create = {
    method: "POST";
    path: "/costumes";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      body: Schemas.Costumes_CreateCostumeRequest;
    };
    responses: { 201: Schemas.Costumes_Costume; default: Schemas.Common_Error };
  };
  export type get_CostumeOperations_getCostumesList = {
    method: "GET";
    path: "/costumes/list";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      query?: Partial<{ page: number; limit: number }>;
    };
    responses: { 200: Schemas.Costumes_GetCostumesList; default: Schemas.Common_Error };
  };
  export type get_CostumeOperations_searchAvailability = {
    method: "GET";
    path: "/costumes/search";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      query: { q: string };
    };
    responses: { 200: Array<Schemas.Costumes_CostumeSearchResult>; default: Schemas.Common_Error };
  };
  export type get_CostumeOperations_searchAvailable = {
    method: "GET";
    path: "/costumes/search-available";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      query: { q?: string; startDate: string; endDate: string };
    };
    responses: { 200: Array<Schemas.Costumes_AvailableCostume>; default: Schemas.Common_Error };
  };
  export type patch_CostumeOperations_update = {
    method: "PATCH";
    path: "/costumes/{costumeId}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { costumeId: number };

      body: Schemas.Costumes_UpdateCostumeRequest;
    };
    responses: { 200: Schemas.Costumes_Costume; default: Schemas.Common_Error };
  };
  export type delete_CostumeOperations_delete = {
    method: "DELETE";
    path: "/costumes/{costumeId}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { costumeId: number };
    };
    responses: { 204: unknown; default: Schemas.Common_Error };
  };
  export type get_CostumeOperations_getDetailedAvailability = {
    method: "GET";
    path: "/costumes/{costumeId}/availability";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { costumeId: number };
    };
    responses: { 200: Schemas.Costumes_CostumeFullAvailability; default: Schemas.Common_Error };
  };
  export type post_VisitOperation_create = {
    method: "POST";
    path: "/visits";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      query?: Partial<{ sendNotification: boolean }>;

      body: Schemas.Visits_CreateVisitRequest;
    };
    responses: { 201: Schemas.Visits_Visit; default: Schemas.Common_Error };
  };
  export type get_VisitOperation_list = {
    method: "GET";
    path: "/visits";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      query?: Partial<{
        q: string;
        status: Schemas.Visits_VisitStatus;
        startDateFrom: string;
        startDateTo: string;
        endDateFrom: string;
        endDateTo: string;
        page: number;
        limit: number;
      }>;
    };
    responses: { 200: Schemas.Visits_PaginatedVisitsResponse; default: Schemas.Common_Error };
  };
  export type get_VisitOperation_getIssuedVisits = {
    method: "GET";
    path: "/visits/issued";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      query?: Partial<{ page: number; limit: number }>;
    };
    responses: { 200: Schemas.Visits_GetIssuedResponse; default: Schemas.Common_Error };
  };
  export type get_VisitOperation_getIssuedForReturn = {
    method: "GET";
    path: "/visits/issued-for-return";
    requestFormat: "json";
    responseFormat: "json";
    parameters: never;
    responses: { 200: Array<Schemas.Visits_IssuedForReturnResponse>; default: Schemas.Common_Error };
  };
  export type get_VisitOperation_getNotWritten = {
    method: "GET";
    path: "/visits/not_written";
    requestFormat: "json";
    responseFormat: "json";
    parameters: never;
    responses: { 200: Schemas.Visits_NotWrittenOrdersResponse; default: Schemas.Common_Error };
  };
  export type get_VisitOperation_getVisitNotification = {
    method: "GET";
    path: "/visits/notification";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      query?: Partial<{ page: number; limit: number }>;
    };
    responses: { 200: Schemas.Visits_GetNotificationResponse; default: Schemas.Common_Error };
  };
  export type get_VisitOperation_searchNotification = {
    method: "GET";
    path: "/visits/notification-search";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      query: { q: string };
    };
    responses: { 200: Array<Schemas.Visits_NotificationItem>; default: Schemas.Common_Error };
  };
  export type post_VisitOperation_previewCode = {
    method: "POST";
    path: "/visits/preview-code";
    requestFormat: "json";
    responseFormat: "json";
    parameters: never;
    responses: { 201: Schemas.Costumes_VisitCode; default: Schemas.Common_Error };
  };
  export type get_VisitOperation_getReserved = {
    method: "GET";
    path: "/visits/reserved";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      query?: Partial<{ startDate: string; endDate: string; page: number; limit: number }>;
    };
    responses: { 200: Schemas.Visits_PaginatedReservedResponse; default: Schemas.Common_Error };
  };
  export type get_VisitOperation_searchForReturn = {
    method: "GET";
    path: "/visits/return-search";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      query: { q: string };
    };
    responses: { 200: Array<Schemas.Visits_VisitReturnSearchResponse>; default: Schemas.Common_Error };
  };
  export type get_VisitOperation_search = {
    method: "GET";
    path: "/visits/search";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      query: { q: string };
    };
    responses: { 200: Array<Schemas.Visits_VisitsSearchResponse>; default: Schemas.Common_Error };
  };
  export type get_VisitOperation_getUnreturnedDeposits = {
    method: "GET";
    path: "/visits/unreturned-deposits";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      query?: Partial<{ page: number; limit: number }>;
    };
    responses: { 200: Schemas.Visits_GetUnreturnedDepositsResponse; default: Schemas.Common_Error };
  };
  export type get_VisitOperation_getUnsettledBalances = {
    method: "GET";
    path: "/visits/unsettled-balances";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      query?: Partial<{ page: number; limit: number }>;
    };
    responses: { 200: Schemas.Visits_PaginatedUnsettledVisitBalancesResponse; default: Schemas.Common_Error };
  };
  export type post_VisitOperation_markTagWritten = {
    method: "POST";
    path: "/visits/{orderId}/mark-tag-written";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { orderId: number };
    };
    responses: { 204: unknown; default: Schemas.Common_Error };
  };
  export type get_VisitOperation_getDetail = {
    method: "GET";
    path: "/visits/{visitId}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { visitId: number };
    };
    responses: { 200: Schemas.Visits_VisitReadDetail; default: Schemas.Common_Error };
  };
  export type get_VisitOperation_getBalance = {
    method: "GET";
    path: "/visits/{visitId}/balance";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { visitId: number };
    };
    responses: { 200: Schemas.Visits_VisitBalance; default: Schemas.Common_Error };
  };
  /**
   * Отмена визита и всех связанных заказов
   */
  export type post_VisitOperation_cancel = {
    method: "POST";
    path: "/visits/{visitId}/cancel";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { visitId: number };

      body: Schemas.Visits_VisitCancelRequest;
    };
    responses: {
      204: unknown;
      400: {
        /**
         * Невозможно отменить визит в текущем статусе
         */
        body: string;
      } & Record<string, unknown>;
      404: {
        /**
         * Визит не найден
         */
        body: string;
      } & Record<string, unknown>;
    };
  };
  export type post_VisitOperation_completeReturn = {
    method: "POST";
    path: "/visits/{visitId}/complete-return";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { visitId: number };

      body: Schemas.Visits_CompleteReturnRequest;
    };
    responses: { 201: Schemas.Visits_CompleteReturnResponse; default: Schemas.Common_Error };
  };
  export type get_VisitOperation_getForIssue = {
    method: "GET";
    path: "/visits/{visitId}/for-issue";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { visitId: number };
    };
    responses: { 200: Schemas.Visits_VisitForIssueResponse; default: Schemas.Common_Error };
  };
  export type get_VisitOperation_getForReturn = {
    method: "GET";
    path: "/visits/{visitId}/for-return";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { visitId: number };
    };
    responses: { 200: Schemas.Visits_VisitForReturnResponse; default: Schemas.Common_Error };
  };
  export type get_VisitOperation_getHistory = {
    method: "GET";
    path: "/visits/{visitId}/history";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      query?: Partial<{ page: number; limit: number }>;
      path: { visitId: number };
    };
    responses: { 200: Schemas.Visits_PaginatedVisitHistoryResponse; default: Schemas.Common_Error };
  };
  export type post_VisitOperation_issue = {
    method: "POST";
    path: "/visits/{visitId}/issue";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { visitId: number };

      body: Schemas.Visits_IssueVisitRequest;
    };
    responses: { 204: unknown; default: Schemas.Common_Error };
  };
  export type post_VisitOperation_markDepositReturned = {
    method: "POST";
    path: "/visits/{visitId}/mark-deposit-returned";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { visitId: number };

      body?: Partial<{ notes: string }> & Record<string, unknown>;
    };
    responses: { 200: Schemas.Visits_MarkDepositReturnedResponse; default: Schemas.Common_Error };
  };
  export type post_VisitOperation_settle = {
    method: "POST";
    path: "/visits/{visitId}/settlement";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { visitId: number };

      body: Schemas.Visits_VisitSettlementRequest;
    };
    responses: { 200: Schemas.Visits_VisitBalance; default: Schemas.Common_Error };
  };
  export type post_VisitOperation_unissue = {
    method: "POST";
    path: "/visits/{visitId}/unissue";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { visitId: number };
    };
    responses: { 204: unknown; default: Schemas.Common_Error };
  };

  // </Endpoints>
}

// <EndpointByMethod>
export type EndpointByMethod = {
  post: {
    "/auth/login": Endpoints.post_AuthOperations_login;
    "/auth/logout": Endpoints.post_AuthOperations_logout;
    "/auth/refresh": Endpoints.post_AuthOperations_refresh;
    "/children": Endpoints.post_ChildOperations_create;
    "/clients": Endpoints.post_ClientOperations_create;
    "/clients/{clientId}/blacklist": Endpoints.post_ClientOperations_addClientInBlackList;
    "/costumes": Endpoints.post_CostumeOperations_create;
    "/visits": Endpoints.post_VisitOperation_create;
    "/visits/preview-code": Endpoints.post_VisitOperation_previewCode;
    "/visits/{orderId}/mark-tag-written": Endpoints.post_VisitOperation_markTagWritten;
    "/visits/{visitId}/cancel": Endpoints.post_VisitOperation_cancel;
    "/visits/{visitId}/complete-return": Endpoints.post_VisitOperation_completeReturn;
    "/visits/{visitId}/issue": Endpoints.post_VisitOperation_issue;
    "/visits/{visitId}/mark-deposit-returned": Endpoints.post_VisitOperation_markDepositReturned;
    "/visits/{visitId}/settlement": Endpoints.post_VisitOperation_settle;
    "/visits/{visitId}/unissue": Endpoints.post_VisitOperation_unissue;
  };
  patch: {
    "/children/{childId}": Endpoints.patch_ChildOperations_update;
    "/clients/{clientId}": Endpoints.patch_ClientOperations_update;
    "/costumes/{costumeId}": Endpoints.patch_CostumeOperations_update;
  };
  delete: {
    "/children/{childId}": Endpoints.delete_ChildOperations_delete;
    "/clients/{clientId}": Endpoints.delete_ClientOperations_delete;
    "/clients/{clientId}/blacklist": Endpoints.delete_ClientOperations_removeClientFromBlackList;
    "/costumes/{costumeId}": Endpoints.delete_CostumeOperations_delete;
  };
  get: {
    "/clients/detail/{clientId}": Endpoints.get_ClientOperations_getClientDetail;
    "/clients/list": Endpoints.get_ClientOperations_getClientList;
    "/clients/search": Endpoints.get_ClientOperations_search;
    "/clients/{clientId}/whatsapp-availability": Endpoints.get_ClientOperations_checkWhatsappAvailability;
    "/costumes/list": Endpoints.get_CostumeOperations_getCostumesList;
    "/costumes/search": Endpoints.get_CostumeOperations_searchAvailability;
    "/costumes/search-available": Endpoints.get_CostumeOperations_searchAvailable;
    "/costumes/{costumeId}/availability": Endpoints.get_CostumeOperations_getDetailedAvailability;
    "/visits": Endpoints.get_VisitOperation_list;
    "/visits/issued": Endpoints.get_VisitOperation_getIssuedVisits;
    "/visits/issued-for-return": Endpoints.get_VisitOperation_getIssuedForReturn;
    "/visits/not_written": Endpoints.get_VisitOperation_getNotWritten;
    "/visits/notification": Endpoints.get_VisitOperation_getVisitNotification;
    "/visits/notification-search": Endpoints.get_VisitOperation_searchNotification;
    "/visits/reserved": Endpoints.get_VisitOperation_getReserved;
    "/visits/return-search": Endpoints.get_VisitOperation_searchForReturn;
    "/visits/search": Endpoints.get_VisitOperation_search;
    "/visits/unreturned-deposits": Endpoints.get_VisitOperation_getUnreturnedDeposits;
    "/visits/unsettled-balances": Endpoints.get_VisitOperation_getUnsettledBalances;
    "/visits/{visitId}": Endpoints.get_VisitOperation_getDetail;
    "/visits/{visitId}/balance": Endpoints.get_VisitOperation_getBalance;
    "/visits/{visitId}/for-issue": Endpoints.get_VisitOperation_getForIssue;
    "/visits/{visitId}/for-return": Endpoints.get_VisitOperation_getForReturn;
    "/visits/{visitId}/history": Endpoints.get_VisitOperation_getHistory;
  };
};

// </EndpointByMethod>

// <EndpointByMethod.Shorthands>
export type PostEndpoints = EndpointByMethod["post"];
export type PatchEndpoints = EndpointByMethod["patch"];
export type DeleteEndpoints = EndpointByMethod["delete"];
export type GetEndpoints = EndpointByMethod["get"];
// </EndpointByMethod.Shorthands>

import "@typespec/http";
import "@typespec/rest";
import "../common/errors.tsp";
import "./costumes.tsp";
import "./clients.tsp";
import "./children.tsp";
using Http;
using OpenAPI;
namespace CostumeApp.Visits;

alias VisitCode = CostumeApp.Costumes.VisitCode;
@pattern("^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$")
scalar TimeString extends string;

enum VisitStatus {
  reserved,
  issued,
  completed,
  cancelled,
}

enum DepositType {
  cash,
  document,
  none,
}

enum TagStatus {
    written,
    not_written,
    not_required,
}

enum OrderStatus {
  reserved,
  issued,
  returned,
  cancelled,
}

model VisitOrder {
  orderId: int32;
  childName: CostumeApp.Children.ChildName;
  costumeName: string;
  inventoryCode: CostumeApp.Costumes.InventoryCode;
  rentPrice: int32;
  prepaymentAmount: int32;
  tagStatus: TagStatus;
  /** Текущий состав костюма — подсказка «Положить в пакет». */
  parts?: CostumeApp.Costumes.CostumePart[];
}
model Visit {
  id: int32;
  visitCode: VisitCode;
  status: VisitStatus;
  
  client: {
    id: int32;
    fullname: CostumeApp.Clients.ClientName;
    phone: CostumeApp.Clients.PhoneString;
  };

  visitDate: {
    startDateTime: plainDate;
    endDateTime: plainDate;
    issueTimeFrom: TimeString;
    issueTimeTo: TimeString;
    returnTimeUntil: TimeString;
  };
  notifications: Notification[],
  orders: VisitOrder[];
}

model Notification {
  id: int32;
  type: string;
  status: "pending" | "sent" | "delivered" | "failed" | "read";
  createdAt: utcDateTime; 
}

model Order {
  orderId: int32;
  inventoryCode: CostumeApp.Costumes.InventoryCode;
  costumeName: string;
  visitCode: CostumeApp.Costumes.VisitCode;
  childName: CostumeApp.Children.ChildName;
  clientPhone: CostumeApp.Clients.PhoneString;
  startDateTime: plainDate;
  endDateTime: plainDate;
  issueTimeFrom: TimeString;
  issueTimeTo: TimeString;
  returnTimeUntil: TimeString;
  rentPrice: int32;
  prepaymentAmount: int32;
  notes: string;
  ...CostumeApp.Costumes.CostumePhotoSummary;
}

model NotWrittenOrdersResponse {
  items: Order[];
  message?: string;
}

model CreateVisitRequest {
  clientId: int32;
  visitCode: VisitCode;
  startDateTime: plainDate;
  issueTimeFrom: TimeString;
  issueTimeTo: TimeString;
  endDateTime: plainDate;
  returnTimeUntil: TimeString;
  notes?: string;
  orders: {
    childId: int32;
    costumeId: int32;
    rentPrice: int32;
    prepaymentAmount: int32;
    notes?: string;
  }[];
}

model IssueVisitRequest {
  @minValue(0) additionalPayment: int32;
  deposit: {
    type: DepositType;
    amount?: int32;
  };
  notes?: string;
}

model QuickIssueVisitRequest {
  @format("uuid") commandId: string;
  clientId: int32;
  visitCode: VisitCode;
  startDateTime: plainDate;
  issueTimeFrom: TimeString;
  issueTimeTo: TimeString;
  endDateTime: plainDate;
  returnTimeUntil: TimeString;
  notes?: string;
  @minItems(1)
  orders: {
    childId: int32;
    costumeId: int32;
    @minValue(0) rentPrice: int32;
    notes?: string;
  }[];
  @minValue(0) additionalPayment: int32;
  deposit: {
    type: DepositType;
    @minValue(0) amount?: int32;
  };
}

model QuickIssueVisitResponse {
  visitId: int32;
  visitCode: VisitCode;
  status: "issued";
  version: int32;
  balance: VisitBalance;
}

model UpdateReservedVisitOrder {
  @minValue(1) orderId?: int32;
  @minValue(1) childId: int32;
  @minValue(1) costumeId: int32;
  @minValue(0) rentPrice: int32;
  /** Initial prepayment for a new order; an existing order's prepayment cannot change. */
  @minValue(0) prepaymentAmount?: int32;
  notes?: string;
}

model UpdateReservedVisitRequest {
  @format("uuid") commandId: string;
  @minValue(1) expectedVersion: int32;
  startDateTime: plainDate;
  issueTimeFrom: TimeString;
  issueTimeTo: TimeString;
  endDateTime: plainDate;
  returnTimeUntil: TimeString;
  notes?: string;
  @minItems(1)
  orders: UpdateReservedVisitOrder[];
}

model AddAndIssueVisitRequestOrder {
  @minValue(1) childId: int32;
  @minValue(1) costumeId: int32;
  @minValue(0) rentPrice: int32;
  notes?: string;
}

model AddAndIssueVisitRequest {
  @format("uuid") commandId: string;
  @minValue(1) expectedVersion: int32;
  @minItems(1)
  orders: AddAndIssueVisitRequestOrder[];
  @minValue(0) additionalPayment: int32;
}

model ReturnMissingParts {
  orderId: int32;
  @minItems(1)
  @maxItems(20)
  parts: string[];
}

model CompleteReturnRequest {
  depositReturned: boolean;
  notes?: string;
  settlement?: VisitSettlementRequest;
  /** Части, которых не оказалось при возврате; возврат не блокируется и денег не начисляет. */
  @maxItems(100)
  missingParts?: ReturnMissingParts[];
}

model VisitBalance {
  @minValue(0) totalRent: int32;
  @minValue(0) totalPrepayment: int32;
  @minValue(0) totalReceived: int32;
  @minValue(0) totalRefunded: int32;
  @doc("Положительное значение — долг, отрицательное — сумма к возврату клиенту")
  signedBalance: int32;
  @minValue(0) debt: int32;
  @minValue(0) refundDue: int32;
}

model VisitListItem {
  id: int32;
  visitCode: VisitCode;
  status: VisitStatus;
  client: {
    id: int32;
    name: CostumeApp.Clients.ClientName;
    phone: CostumeApp.Clients.PhoneString;
  };
  startDateTime: plainDate;
  endDateTime: plainDate;
  issueTimeFrom: TimeString;
  issueTimeTo: TimeString;
  returnTimeUntil: TimeString;
  childrenNames: string;
  costumesNames: string;
  orderCount: int32;
  totalRent: int32;
  totalPrepayment: int32;
  totalRemaining: int32;
  createdAt: utcDateTime;
}

model PaginatedVisitsResponse {
  items: VisitListItem[];
  total: int32;
  page: int32;
  limit: int32;
  hasMore: boolean;
}

model VisitReadOrder {
  orderId: int32;
  childId: int32;
  childName: CostumeApp.Children.ChildName;
  costumeId: int32;
  costumeName: string;
  inventoryCode: CostumeApp.Costumes.InventoryCode;
  status: OrderStatus;
  tagStatus: TagStatus;
  rentPrice: int32;
  prepaymentAmount: int32;
  finalPayment?: int32;
  notes?: string;
  /** Состав на момент выдачи (у невыданных — текущий состав костюма). */
  parts?: CostumeApp.Costumes.CostumePart[];
  ...CostumeApp.Costumes.CostumePhotoSummary;
}

model VisitReadDeposit {
  id: int32;
  type: DepositType;
  amount?: int32;
  returned: boolean;
  createdAt: utcDateTime;
}

model VisitReadMoneyOperation {
  id: int32;
  kind: "issue_payment" | "debt_payment" | "customer_refund";
  amount: int32;
  createdAt: utcDateTime;
  voidedAt?: utcDateTime;
  legacyImported: boolean;
}

model VisitReadTotals {
  totalRent: int32;
  totalPrepayment: int32;
  totalRemaining: int32;
}

model VisitReadDetail {
  id: int32;
  visitCode: VisitCode;
  status: VisitStatus;
  version: int32;
  client: {
    id: int32;
    name: CostumeApp.Clients.ClientName;
    phone: CostumeApp.Clients.PhoneString;
  };
  startDateTime: plainDate;
  endDateTime: plainDate;
  issueTimeFrom: TimeString;
  issueTimeTo: TimeString;
  returnTimeUntil: TimeString;
  notes?: string;
  createdAt: utcDateTime;
  orders: VisitReadOrder[];
  moneyOperations: VisitReadMoneyOperation[];
  deposits: VisitReadDeposit[];
  totals: VisitReadTotals;
  balance?: VisitBalance;
}

model VisitSettlementRequest {
  kind: "debt_payment" | "customer_refund";
  @minValue(1) amount: int32;
}

enum VisitHistorySource {
  user,
  system,
  imported: "import",
}

enum VisitHistoryAction {
  visitCreated: "visit.created",
  visitUpdated: "visit.updated",
  tagInvalidated: "tag.invalidated",
  tagWritten: "tag.written",
  visitIssued: "visit.issued",
  visitUnissued: "visit.unissued",
  visitCancelled: "visit.cancelled",
  visitCompleted: "visit.completed",
  depositReturned: "deposit.returned",
  moneyReceived: "money.received",
  moneyRefunded: "money.refunded",
  ordersAddedAndIssued: "orders.added_and_issued",
  returnMissingParts: "return.missing_parts",
}

model VisitHistoryOrderSnapshot {
  orderId: int32;
  childId?: int32;
  childName: string;
  costumeId?: int32;
  costumeName: string;
  inventoryCode: CostumeApp.Costumes.InventoryCode;
  rentPrice: int32;
  prepaymentAmount: int32;
  tagStatus?: TagStatus;
  notes?: string | null;
}

model VisitCreatedHistoryPayload {
  kind: "visit.created";
  visitCode: VisitCode;
  clientId: int32;
  clientName: string;
  startDateTime: plainDate;
  endDateTime: plainDate;
  orders: VisitHistoryOrderSnapshot[];
}

model VisitUpdatedHistoryOrderChange {
  change: "added" | "updated" | "removed";
  orderId: int32;
  before?: VisitHistoryOrderSnapshot;
  after?: VisitHistoryOrderSnapshot;
}

model VisitUpdatedHistoryPayload {
  kind: "visit.updated";
  changedFields: {
    startDateTime?: { before: plainDate; after: plainDate };
    issueTimeFrom?: { before: TimeString; after: TimeString };
    issueTimeTo?: { before: TimeString; after: TimeString };
    endDateTime?: { before: plainDate; after: plainDate };
    returnTimeUntil?: { before: TimeString; after: TimeString };
    notes?: { before: string | null; after: string | null };
  };
  orderChanges: VisitUpdatedHistoryOrderChange[];
}

model TagInvalidatedHistoryPayload {
  kind: "tag.invalidated";
  orderId: int32;
  childName: string;
  costumeName: string;
  inventoryCode: CostumeApp.Costumes.InventoryCode;
  reason: "date_changed" | "window_changed" | "child_changed" | "costume_changed";
  previousTagStatus: "written";
  tagStatus: "not_written";
}

model TagWrittenHistoryPayload {
  kind: "tag.written";
  orderId: int32;
  childName: string;
  costumeName: string;
  inventoryCode: CostumeApp.Costumes.InventoryCode;
}

model VisitIssuedHistoryPayload {
  kind: "visit.issued";
  visitCode: VisitCode;
  additionalPayment: int32;
  depositType: DepositType;
  depositAmount: int32;
  orders: VisitHistoryOrderSnapshot[];
}

model VisitUnissuedHistoryPayload {
  kind: "visit.unissued";
  visitCode: VisitCode;
  voidedPaymentAmount: int32;
  depositType?: DepositType;
  depositAmount?: int32;
  orders: VisitHistoryOrderSnapshot[];
}

model VisitCancelledHistoryPayload {
  kind: "visit.cancelled";
  visitCode: VisitCode;
  reason?: string;
}

model VisitCompletedHistoryPayload {
  kind: "visit.completed";
  visitCode: VisitCode;
  orders: VisitHistoryOrderSnapshot[];
  settlementKind?: "debt_payment" | "customer_refund";
  settlementAmount?: int32;
}

model DepositReturnedHistoryPayload {
  kind: "deposit.returned";
  depositType: DepositType;
  amount: int32;
}

model MoneyReceivedHistoryPayload {
  kind: "money.received";
  moneyKind: "issue_payment" | "debt_payment";
  amount: int32;
}

model MoneyRefundedHistoryPayload {
  kind: "money.refunded";
  amount: int32;
}

model OrdersAddedAndIssuedHistoryPayload {
  kind: "orders.added_and_issued";
  visitCode: VisitCode;
  orders: VisitHistoryOrderSnapshot[];
}

model ReturnMissingPartsHistoryPayload {
  kind: "return.missing_parts";
  visitCode: VisitCode;
  orderId: int32;
  childName: string;
  costumeName: string;
  inventoryCode: CostumeApp.Costumes.InventoryCode;
  parts: string[];
}

union VisitHistoryPayload {
  visitCreated: VisitCreatedHistoryPayload,
  visitUpdated: VisitUpdatedHistoryPayload,
  tagInvalidated: TagInvalidatedHistoryPayload,
  tagWritten: TagWrittenHistoryPayload,
  visitIssued: VisitIssuedHistoryPayload,
  visitUnissued: VisitUnissuedHistoryPayload,
  visitCancelled: VisitCancelledHistoryPayload,
  visitCompleted: VisitCompletedHistoryPayload,
  depositReturned: DepositReturnedHistoryPayload,
  moneyReceived: MoneyReceivedHistoryPayload,
  moneyRefunded: MoneyRefundedHistoryPayload,
  ordersAddedAndIssued: OrdersAddedAndIssuedHistoryPayload,
  returnMissingParts: ReturnMissingPartsHistoryPayload,
}

model VisitHistoryEvent {
  id: int32;
  occurredAt: utcDateTime;
  actorUserId?: int32;
  actorNameSnapshot: string;
  source: VisitHistorySource;
  action: VisitHistoryAction;
  entityType: "visit" | "order";
  entityId: int32;
  visitId: int32;
  orderId?: int32;
  commandId: string;
  schemaVersion: 1;
  payload: VisitHistoryPayload;
}

model PaginatedVisitHistoryResponse {
  items: VisitHistoryEvent[];
  total: int32;
  page: int32;
  limit: int32;
  hasMore: boolean;
}

model UnsettledVisitBalance {
  visitId: int32;
  visitCode: VisitCode;
  clientName: CostumeApp.Clients.ClientName;
  clientPhone: CostumeApp.Clients.PhoneString;
  balance: VisitBalance;
}

model PaginatedUnsettledVisitBalancesResponse {
  items: UnsettledVisitBalance[];
  total: int32;
  page: int32;
  limit: int32;
  hasMore: boolean;
}

model GetReservedResponse {
    visitId: int32;
    visitCode: VisitCode;
    clientName: CostumeApp.Clients.ClientName;
    childrenNames: string;
    costumesNames: string;
    clientPhone: CostumeApp.Clients.PhoneString;
}

model PaginatedReservedResponse {
  items: GetReservedResponse[];
  total: int32;
  page: int32;
  limit: int32;
  hasMore: boolean;
}

model VisitsSearchResponse {
    visitId: int32;
    visitCode: VisitCode;
    clientName: CostumeApp.Clients.ClientName;
    clientPhone: CostumeApp.Clients.PhoneString;
    startDateTime: plainDate;
    childrenNames: string;
    costumesNames: string;
}

model VisitIssueOrder {
  ...VisitOrder;
  ...CostumeApp.Costumes.CostumePhotoSummary;
}

model VisitForIssueResponse {
  visitId: int32;
  visitCode: VisitCode;
  client: { name: CostumeApp.Clients.ClientName; phone: CostumeApp.Clients.PhoneString };
  startDateTime: plainDate;
  issueTimeFrom: TimeString;
  issueTimeTo: TimeString;
  returnTimeUntil: TimeString;
  endDateTime: plainDate;
  totalRentPrice: int32;
  totalPrepayment: int32;
  remainingToPay: int32;
  notes: string;
  orders: VisitIssueOrder[];
}

model IssuedForReturnResponse {
  visitId: int32;
  visitCode: VisitCode;
  clientName: CostumeApp.Clients.ClientName;
  childrenNames: string;
  costumeNames: string;
  endDateTime: plainDate;
  clientPhone: CostumeApp.Clients.PhoneString;
  notes: string;
}

model VisitForReturnResponse {
  visitId: int32;
  visitCode: VisitCode;
  client: { name: CostumeApp.Clients.ClientName; phone: CostumeApp.Clients.PhoneString };
  startDateTime: plainDate;
  endDateTime: plainDate;
  notes: string;
  orders: VisitReturnOrder[];
  deposit: VisitDepositInfo;
  balance: VisitBalance;
}

model VisitReturnOrder {
  orderId: int32;
  childName: CostumeApp.Children.ChildName;
  costumeName: string;
  inventoryCode: CostumeApp.Costumes.InventoryCode;
  rentPrice: int32;
  prepaymentAmount: int32;
  finalPayment: int32;
  returned: boolean;
  /** Состав, выданный клиенту (у старых заказов без снимка — текущий состав костюма). */
  parts?: CostumeApp.Costumes.CostumePart[];
  ...CostumeApp.Costumes.CostumePhotoSummary;
}

model VisitDepositInfo {
  type: DepositType;
  amount?: int32;
}

model CompleteReturnResponse {
  visitId: int32;
  visitCode: VisitCode;
  status: VisitStatus;
  message: string;
  balance: VisitBalance;
}

model MarkDepositReturnedResponse {
  visitId: int32;
  depositReturned: boolean;
  message: string;
}

model VisitReturnSearchResponse {
  visitId: int32;
  visitCode: VisitCode;
  childrenNames: string;
  costumesNames: string;
  returnDate: plainDate;
  clientPhone: CostumeApp.Clients.PhoneString;
  clientName: CostumeApp.Clients.ClientName;
}

model GetUnreturnedResponse{
  visitId: int32;
  visitCode: VisitCode;
  childrenNames: string;
  costumeNames: string;
  startDateTime: plainDate;
  endDateTime: plainDate;
  clientPhone: CostumeApp.Clients.PhoneString;
  clientName: CostumeApp.Clients.ClientName;
  deposit: VisitDepositInfo;
  notes: string;
}
model GetUnreturnedDepositsResponse{
  items: GetUnreturnedResponse[];
  total: int32;
  page: int32;
  limit: int32;
  hasMore: boolean;
}

model GetIssuedItem{
  visitId: int32;
  visitCode: VisitCode;
  clientName: CostumeApp.Clients.ClientName;
  clientPhone: CostumeApp.Clients.PhoneString;
  startDateTime: plainDate;
  endDateTime: plainDate;
  childrenNames: string;
  costumesNames: string;
  deposit: VisitDepositInfo;
}
model GetIssuedResponse{
  items: GetIssuedItem[];
  total: int32;
  page: int32;
  limit: int32;
  hasMore: boolean;
}

model NotificationItem {
  notificationId: int32;
  status: "pending" | "sent" | "delivered" | "failed" | "isConfirmed" | "read" | "noAccount";
  visitCode: VisitCode;
  clientName: CostumeApp.Clients.ClientName;
  clientPhone: CostumeApp.Clients.PhoneString;
  childrenNames: string;
  costumeNames: string;
  message: string;
}

model GetNotificationResponse {
  items: NotificationItem[];
  totalToday: int32;
  total: int32;
  page: int32;
  limit: int32;
  hasMore: boolean;
}
@doc("Запрос на отмену визита")
model VisitCancelRequest {
  @doc("Причина отмены визита")
  reason?: string;
}

@route("/visits")
interface VisitOperation {
  @post
  @route("preview-code")
  previewCode(): {
    @statusCode statusCode: 201;
    @header contentType: "application/json";
    @body body: VisitCode;
  } | Common.Error;

  @post
  create(
    @query sendNotification?: boolean = true,
    @body body: CreateVisitRequest): {
    @statusCode statusCode: 201;
    @body body: Visit;
  } | Common.Error;

  @post
  @route("quick-issue")
  quickIssue(@body body: QuickIssueVisitRequest): {
    @statusCode statusCode: 201;
    @body body: QuickIssueVisitResponse;
  } | Common.Error;

  @patch
  @route("{visitId}")
  updateReserved(
    @path visitId: int32,
    @body body: UpdateReservedVisitRequest,
  ): {
    @statusCode statusCode: 200;
    @body body: VisitReadDetail;
  } | Common.Error;

  @post
  @route("{visitId}/add-and-issue")
  addAndIssue(
    @path visitId: int32,
    @body body: AddAndIssueVisitRequest,
  ): {
    @statusCode statusCode: 200;
    @body body: VisitReadDetail;
  } | Common.Error;

  @get
  list(
    @query @minLength(2) q?: string,
    @query status?: VisitStatus,
    @query startDateFrom?: plainDate,
    @query startDateTo?: plainDate,
    @query endDateFrom?: plainDate,
    @query endDateTo?: plainDate,
    @query @minValue(1) page?: int32,
    @query @minValue(1) @maxValue(100) limit?: int32,
  ): {
    @statusCode statusCode: 200;
    @body body: PaginatedVisitsResponse;
  } | Common.Error;

  @get
  @route("{visitId}")
  getDetail(@path visitId: int32): {
    @statusCode statusCode: 200;
    @body body: VisitReadDetail;
  } | Common.Error;

  @get
  @route("{visitId}/history")
  getHistory(
    @path visitId: int32,
    @query @minValue(1) page?: int32,
    @query @minValue(1) @maxValue(100) limit?: int32,
  ): {
    @statusCode statusCode: 200;
    @body body: PaginatedVisitHistoryResponse;
  } | Common.Error;

@get
@route("reserved")
getReserved(
  @query startDate?: string, 
  @query endDate?: string, 
  @query page?: int32,   
  @query limit?: int32 
): {
  @statusCode statusCode: 200;
  @body body: PaginatedReservedResponse;
} | Common.Error;


  @get
  @route("search")
  search(@query @minLength(2) q: string): {
    @statusCode statusCode: 200;
    @body body: VisitsSearchResponse[];
  } | Common.Error;

  @get
  @route("return-search")
  searchForReturn(@query @minLength(2) q: string): {
    @statusCode statusCode: 200;
    @body body: VisitReturnSearchResponse[];
  } | Common.Error;

  @get
  @route("unsettled-balances")
  getUnsettledBalances(@query page?: int32, @query limit?: int32): {
    @statusCode statusCode: 200;
    @body body: PaginatedUnsettledVisitBalancesResponse;
  } | Common.Error;


  @get
  @route("{visitId}/for-issue")
  getForIssue(@path visitId: int32): {
    @statusCode statusCode: 200;
    @body body: VisitForIssueResponse;
  } | Common.Error;

  
  @post
  @route("{visitId}/issue")
  issue(@path visitId: int32, @body body: IssueVisitRequest): {
    @statusCode statusCode: 204;
  } | Common.Error;

  @post
  @route("{visitId}/unissue")
  unissue(@path visitId: int32): {
    @statusCode statusCode: 204;
  } | Common.Error;
  
  @get
  @route("issued-for-return")
  getIssuedForReturn(): {
    @statusCode statusCode: 200;
    @body body: IssuedForReturnResponse[];
  } | Common.Error;

  
  @get
  @route("{visitId}/for-return")
  getForReturn(@path visitId: int32): {
    @statusCode statusCode: 200;
    @body body: VisitForReturnResponse;
  } | Common.Error;

  
  @post
  @route("{visitId}/complete-return")
  completeReturn(@path visitId: int32, @body body: CompleteReturnRequest): {
    @statusCode statusCode: 201;
    @body body: CompleteReturnResponse;
  } | Common.Error;

  @get
  @route("{visitId}/balance")
  getBalance(@path visitId: int32): {
    @statusCode statusCode: 200;
    @body body: VisitBalance;
  } | Common.Error;

  @post
  @route("{visitId}/settlement")
  settle(@path visitId: int32, @body body: VisitSettlementRequest): {
    @statusCode statusCode: 200;
    @body body: VisitBalance;
  } | Common.Error;

 
  @post
  @route("{visitId}/mark-deposit-returned")
  markDepositReturned(@path visitId: int32, @body body: { notes?: string }): {
    @statusCode statusCode: 200;
    @body body: MarkDepositReturnedResponse;
  } | Common.Error;

  @get
  @route("unreturned-deposits")
  getUnreturnedDeposits( @query page?: int32, @query limit?: int32): {
    @statusCode statusCode: 200;
    @body body: GetUnreturnedDepositsResponse;
  } | Common.Error;

  @get
  @route("issued")
  getIssuedVisits(@query page?: int32, @query limit?: int32): {
    @statusCode statusCode: 200;
    @body body: GetIssuedResponse;
  } | Common.Error;

  @get
  @route("not_written")
  getNotWritten(): {
    @statusCode statusCode: 200;
    @body body: NotWrittenOrdersResponse;
  } | Common.Error;

  @post
  @route("{orderId}/mark-tag-written")
  markTagWritten(@path orderId: int32): {
    @statusCode statusCode: 204;
  } | Common.Error;

  @get
  @route("notification")
  getVisitNotification(@query page?: int32, @query limit?: int32): {
    @statusCode statusCode: 200;
    @body body: GetNotificationResponse;
  } | Common.Error;

  @get
  @route("notification-search")
  searchNotification(@query @minLength(2) q: string): {
    @statusCode statusCode: 200;
    @body body: NotificationItem[];
  } | Common.Error;

  @doc("Отмена визита и всех связанных заказов")
  @post
  @route("{visitId}/cancel")
  cancel(
    @path visitId: int32,
    @body @doc("Данные об отмене") body: VisitCancelRequest
  ): {
    @statusCode statusCode: 204;
  } | {
    @statusCode statusCode: 404;
    @doc("Визит не найден")
    body: string;
  } | {
    @statusCode statusCode: 400;
    @doc("Невозможно отменить визит в текущем статусе")
    body: string;
  };
}


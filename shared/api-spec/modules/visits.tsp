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
  additionalPayment: int32;
  deposit: {
    type: DepositType;
    amount?: int32;
  };
  notes?: string;
}

model CompleteReturnRequest {
  depositReturned: boolean;
  notes?: string;
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
  orders: VisitOrder[];
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
    visitCode: VisitCode;
  } | Common.Error;

  @post
  create(
    @query sendNotification?: boolean = true,
    @body body: CreateVisitRequest): {
    @statusCode statusCode: 201;
    @body body: Visit;
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
    @statusCode statusCode: 200;
    @body body: CompleteReturnResponse;
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


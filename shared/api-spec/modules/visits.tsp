import "@typespec/http";
import "@typespec/rest";
import "../common/errors.tsp";
import "./costumes.tsp";
import "./clients.tsp";
import "./children.tsp";
using Http;

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

model VisitOrder {
  orderId: int32;
  childName: CostumeApp.Children.ChildName;
  costumeName: string;
  inventoryCode: CostumeApp.Costumes.InventoryCode;
  rentPrice: int32;
  prepayment: int32;
  remaining: int32;
  tagStatus: TagStatus;
}

model VisitTotals {
  totalRent: int32;
  totalPrepayment: int32;
  totalRemaining: int32;
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
    startDate: plainDate;
    endDate: plainDate;
    issueTimeFrom: TimeString;
    issueTimeTo: TimeString;
    returnTimeUntil: TimeString;
  };

  orders: VisitOrder[];
  totals: VisitTotals;
}

model CreateVisitRequest {
  clientId: int32;
  startDate: plainDate;
  issueTimeFrom: TimeString;
  issueTimeTo: TimeString;
  endDate: plainDate;
  returnTimeUntil: TimeString;
  notes?: string;
  orders: {
    childId: int32;
    costumeId: int32;
    rentPrice: int32;
    prepaymentAmount: int32;
    remaining: int32;
    notes?: string;
  }[];
}

model IssueVisitRequest {
  additionalPayment: int32;
  deposit: {
    type: DepositType;
    amount?: int32; //обязательно, если deposit cash
  };
  notes?: string;
}

model CompleteReturnRequest {
  returnedOrderIds: int32[];
  depositReturned: boolean;
  notes?: string;
}

model GetTodayReservedResponse {
    visitId: int32;
    visitCode: VisitCode;
    clientName: CostumeApp.Clients.ClientName;
    childrenNames: string;
    costumesNames: string;
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
  returned: boolean;
}

model VisitDepositInfo {
  type: DepositType;
  amount: int32;
  returned: boolean;
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
  costumeNames: string;
  returnDate: plainDate;
  clientPhone: CostumeApp.Clients.PhoneString;
  clientName: CostumeApp.Clients.ClientName;
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
  create(@body body: CreateVisitRequest): {
    @statusCode statusCode: 201;
    @body body: Visit;
  } | Common.Error;

  @get
  @route("today-reserved")
  getTodayReserved(): {
    @statusCode statusCode: 200;
    @body body: GetTodayReservedResponse[];
  }[] | Common.Error;


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
}


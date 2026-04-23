import "@typespec/http";
import "@typespec/rest";
import "../common/errors.tsp";

using Http;

namespace CostumeApp.Clients;

@minLength(2)
@pattern("^[a-zA-Zа-яА-ЯёЁәіңғүұқөһӘІҢҒҮҰҚӨҺ\\s-]+$")
scalar ClientName extends string;

@pattern("^\\+7\\d{10}$")
scalar PhoneString extends string;

model Client {
  clientId: int32;
  name: ClientName;
  phone: PhoneString;
  children?: CostumeApp.Children.Child[];
  isBlacklisted: boolean;
  blacklistReason?: string;
}
model CreateClientRequest {
  name: ClientName;
  phone: PhoneString;
}

model UpdateClientRequest {
  name?: ClientName;
  phone?: PhoneString;
}

model ClientItem {
  clientId: int32;
  name: ClientName;
  phone: PhoneString;
  isBlacklisted: boolean;
}
model GetClientList{
  items: ClientItem[];
  totalOrders: int32;
  total: int32;
  page: int32;
  limit: int32;
  hasMore: boolean;
}

model ClientOrderHistory {
  orderId: int32;
  costumeName: string;
  inventoryCode: string;
  childName: string;
  orderStatus: CostumeApp.Visits.OrderStatus;
  rentPrice: int32;
  prepaymentAmount: int32;
  finalPayment?: int32; 
}

model ClientVisitHistory {
  visitId: int32;
  visitCode: CostumeApp.Costumes.VisitCode;
  visitStatus: CostumeApp.Visits.VisitStatus;
  createdAt: utcDateTime;
  startDateTime: plainDate;
  endDateTime: plainDate;
  issueTimeFrom: CostumeApp.Visits.TimeString;
  returnTimeUntil: CostumeApp.Visits.TimeString;
  visitNote?: string;

  orders: ClientOrderHistory[];
}
model GetClientDetailed {
  client: Client;
  visits: ClientVisitHistory[];
}

model blacklistReason {
  blacklistReason?: string
}
@route("/clients")
interface ClientOperations {
  @get
  @route("search")
  search(
    @query @minLength(2) q: string
  ): Client[] | Common.Error;

  @post
  create(@body client: CreateClientRequest): {
    @statusCode statusCode: 201;
    @body body: Client;
  } | Common.Error;

  @patch(#{ implicitOptionality: true })
  @route("{clientId}")
  update(
    @path clientId: int32,
    @body client: UpdateClientRequest
  ) : {
    @statusCode statusCode: 200;
    @body body: Client;
  } | Common.Error;
  
  @delete
  @route("{clientId}")
  delete(@path clientId: int32): {
    @statusCode statusCode: 204;
  } | Common.Error;

  @get
  @route("list")
  getClientList(@query page?: int32, @query limit?: int32): {
    @statusCode statusCode: 200;
    @body body: GetClientList} | Common.Error;
  
  @get
  @route("detail/{clientId}")
  getClientDetail(@path clientId: int32): {
    @statusCode statusCode: 200;
    @body body: GetClientDetailed
  } | Common.Error;

  @post
  @route("{clientId}/blacklist")
  addClientInBlackList(@path clientId: int32, @body request: blacklistReason; ): {
    @statusCode statusCode: 201;
    @body body: void;
  } | Common.Error;

  @delete
  @route("{clientId}/blacklist")
  removeClientFromBlackList(@path clientId: int32): {
    @statusCode statusCode: 204;
  } | Common.Error;
}
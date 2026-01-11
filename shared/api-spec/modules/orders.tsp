import "@typespec/http";
import "@typespec/rest";
import "../common/errors.tsp";
import "./costumes.tsp";
import "./clients.tsp";
import "./children.tsp";

using Http;

namespace CostumeApp.Orders;

model Order {
    orderId: int32;
    inventoryCode: CostumeApp.Costumes.InventoryCode;
    costumeName: string;
  visitCode: CostumeApp.Costumes.VisitCode;
    childName: CostumeApp.Children.ChildName;
    clientPhone: CostumeApp.Clients.PhoneString;
    startDateTime: plainDate;
    endDateTime: plainDate;
    rentPrice: int32;
  prepaymentAmount: int32;
  notes: string;
}

model NotWrittenOrdersResponse {
  items: Order[];
  message?: string;
}

@route("/orders")
interface OrderOperations{
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
}
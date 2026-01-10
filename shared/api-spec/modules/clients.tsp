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
  children?: string[];
}

model CreateClientRequest {
  name: ClientName;
  phone: PhoneString;
}

model UpdateClientRequest {
  name?: ClientName;
  phone?: PhoneString;
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
  }
}
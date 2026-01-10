import "@typespec/http";
import "@typespec/rest";
import "../common/errors.tsp";

using Http;

namespace CostumeApp.Children;

@minLength(2)
@pattern("^[a-zA-Zа-яА-ЯёЁәіңғүұқөһӘІҢҒҮҰҚӨҺ\\s-]+$")
scalar ChildName extends string;

model Child {
  childId: int32;
  name: ChildName;
  clientId: int32;
}

model CreateChildRequest {
  clientId: int32;
  name: ChildName;
}

model UpdateChildRequest {
  name?: ChildName;
}

model ChildUpdateResponse {
  childId: int32;
  name: ChildName;
}

@route("/children")
interface ChildOperations {
    @post
  create(@body child: CreateChildRequest): {
    @statusCode statusCode: 201;
    @body body: Child;
  } | Common.Error;

  @patch(#{ implicitOptionality: true })
  @route("{childId}")
  update(
    @path childId: int32,
    @body body: UpdateChildRequest
  ): {
    @statusCode statusCode: 200;
    @body body: ChildUpdateResponse;
  } | Common.Error;
}
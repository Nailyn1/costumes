import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi3";

import "./common/errors.tsp";
import "./modules/auth.tsp";
import "./modules/clients.tsp";
import "./modules/children.tsp";
import "./modules/costumes.tsp";

using Http;
@service(#{ title: "Costume Rental Service API" })
@server("http://localhost:3000", "Локальный сервер разработки")

@useAuth(BearerAuth)
namespace CostumeApp {
  model BearerAuth is Http.BearerAuth;
}


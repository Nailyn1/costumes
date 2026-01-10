import "@typespec/http";
import "@typespec/rest";
import "../common/errors.tsp";

using Http;

namespace CostumeApp.Costumes;

@pattern("^C-\\d{4}$")
scalar InventoryCode extends string;


@pattern("^\\d{4}$")
scalar VisitCode extends string;

enum CostumeStatus {
  available: "available",
  issued: "issued",
}

model Costume {
  costumeId: int32;
  name: string;
  inventoryCode: InventoryCode;
}

model AvailableCostume extends Costume {
  status: CostumeStatus;
}

model CostumeSearchResult extends Costume {
  display: string;
}

model AvailabilityPeriod {
  visitCode: VisitCode;
  childName: string;
  clientPhone: string;
  startDateTime: utcDateTime;
  endDateTime: utcDateTime;
}

model CostumeFullAvailability extends Costume {
  periods: AvailabilityPeriod[];
  noPeriodsMessage: string | null;
}

model CreateCostumeRequest {
  @minLength(2)
  name: string;
}

model UpdateCostumeRequest {
  @minLength(2)
  name?: string;
}

@route("/costumes")
interface CostumeOperations {
    @get
  @route("search-available")
  searchAvailable(
    @query q?: string,
    @query startDate: plainDate,
    @query endDate: plainDate
  ): AvailableCostume[] | Common.Error;

  @get
  @route("search-availability")
  searchAvailability(@query q: string): CostumeSearchResult[] | Common.Error;

  @get
  @route("{costumeId}/availability")
  getDetailedAvailability(@path costumeId: int32): CostumeFullAvailability | Common.Error;

  @post
  create(@body costume: CreateCostumeRequest): {
    @statusCode statusCode: 201;
    @body body: Costume;
  } | Common.Error;
  
  @patch(#{ implicitOptionality: true })
  @route("{costumeId}")
  update(
    @path costumeId: int32,
    @body costume: UpdateCostumeRequest
  ): {
    @statusCode statusCode: 200;
    @body body: Costume;
  } | Common.Error;
}
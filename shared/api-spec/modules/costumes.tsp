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

enum CostumeGender {
  girl: "girl",
  boy: "boy",
  unisex: "unisex",
}

@minValue(50)
@maxValue(200)
scalar HeightCm extends int32;

@maxLength(20)
scalar SizeLabel extends string;

/** Часть костюма, которую можно потерять или забыть положить (основу не указываем). */
model CostumePart {
  @minLength(1)
  @maxLength(40)
  name: string;

  @minValue(1)
  @maxValue(20)
  qty: int32;
}

@minLength(2)
@maxLength(40)
scalar CategoryName extends string;

/** Краткая ссылка на категорию в ответах по костюму. */
model CostumeCategoryRef {
  id: int32;
  name: string;
  parentId: int32 | null;
  parentName: string | null;
}

model CostumeSubcategory {
  id: int32;
  name: string;
  sortOrder: int32;
}

/** Основная категория с подкатегориями (максимум два уровня). */
model CostumeCategoryNode {
  id: int32;
  name: string;
  sortOrder: int32;
  children: CostumeSubcategory[];
}

model CostumeCategory {
  id: int32;
  name: string;
  parentId: int32 | null;
  sortOrder: int32;
}

model CreateCostumeCategoryRequest {
  name: CategoryName;

  /** Не задан — основная категория; задан — подкатегория этой основной категории. */
  parentId?: int32;
}

model UpdateCostumeCategoryRequest {
  name?: CategoryName;
  sortOrder?: int32;
}

@route("/costume-categories")
interface CostumeCategoryOperations {
  @get
  list(): CostumeCategoryNode[] | Common.Error;

  @post
  create(@body category: CreateCostumeCategoryRequest): {
    @statusCode statusCode: 201;
    @body body: CostumeCategory;
  } | Common.Error;

  @patch
  @route("{categoryId}")
  update(
    @path categoryId: int32,
    @body category: UpdateCostumeCategoryRequest
  ): {
    @statusCode statusCode: 200;
    @body body: CostumeCategory;
  } | Common.Error;

  @delete
  @route("{categoryId}")
  delete(@path categoryId: int32): {
    @statusCode statusCode: 204;
  } | Common.Error;
}

model Costume {
  costumeId: int32;
  name: string;
  inventoryCode: InventoryCode;
  category?: CostumeCategoryRef | null;
  gender?: CostumeGender | null;
  heightFrom?: HeightCm | null;
  heightTo?: HeightCm | null;
  sizeLabel?: SizeLabel | null;
  parts?: CostumePart[];
}

model AvailableCostume {
  ...Costume;
  status: CostumeStatus;
}

model CostumeSearchResult {
  ...Costume;
  display: string;
}

model AvailabilityPeriod {
  visitCode: VisitCode;
  clientName: string;
  childName: string;
  clientPhone: string;
  startDateTime: plainDate;
  endDateTime: plainDate;
  issueTimeFrom: CostumeApp.Visits.TimeString;
  returnTimeUntil: CostumeApp.Visits.TimeString;
}

model CostumeFullAvailability {
  ...Costume;
  periods: AvailabilityPeriod[];
  noPeriodsMessage: string | null;
}
model GetCostumesList{
  items: Costume[];
  total: int32;
  page: int32;
  limit: int32;
  hasMore: boolean;
}
model CreateCostumeRequest {
  @minLength(2)
  name: string;
  categoryId?: int32 | null;
  gender?: CostumeGender | null;
  heightFrom?: HeightCm | null;
  heightTo?: HeightCm | null;
  sizeLabel?: SizeLabel | null;
  @maxItems(20)
  parts?: CostumePart[];
}

model UpdateCostumeRequest {
  @minLength(2)
  name?: string;
  categoryId?: int32 | null;
  gender?: CostumeGender | null;
  heightFrom?: HeightCm | null;
  heightTo?: HeightCm | null;
  sizeLabel?: SizeLabel | null;
  @maxItems(20)
  parts?: CostumePart[];
}

@route("/costumes")
interface CostumeOperations {
    @get
  @route("search-available")
  searchAvailable(
    @query q?: string,
    @query startDate: string,
    @query endDate: string,
    @query excludeVisitId?: int32,
    @query categoryId?: int32,
    @query gender?: CostumeGender,
    @query height?: HeightCm,
    @query withoutCategory?: boolean
  ): AvailableCostume[] | Common.Error;

  @get
  @route("search")
  searchAvailability(
    @query q: string,
    @query categoryId?: int32,
    @query gender?: CostumeGender,
    @query height?: HeightCm,
    @query withoutCategory?: boolean
  ): CostumeSearchResult[] | Common.Error;

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

  @delete
  @route("{costumeId}")
  delete(@path costumeId: int32): {
    @statusCode statusCode: 204;
  } | Common.Error;

  @get
  @route("list")
  getCostumesList(
    @query page?: int32,
    @query limit?: int32,
    @query categoryId?: int32,
    @query gender?: CostumeGender,
    @query height?: HeightCm,
    @query withoutCategory?: boolean
  ): {
    @statusCode statusCode: 200;
    @body body: GetCostumesList} | Common.Error;
}

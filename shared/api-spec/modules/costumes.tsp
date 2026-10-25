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
  ...CostumePhotoSummary;
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
    @query startDate: string,
    @query endDate: string,
    @query excludeVisitId?: int32
  ): AvailableCostume[] | Common.Error;

  @get
  @route("search")
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

  @delete
  @route("{costumeId}")
  delete(@path costumeId: int32): {
    @statusCode statusCode: 204;
  } | Common.Error;

  @get
  @route("list")
  getCostumesList(@query page?: int32, @query limit?: int32): {
    @statusCode statusCode: 200;
    @body body: GetCostumesList} | Common.Error;
}


// ---- Фото костюмов (T-111) ----

/** Краткие сведения о фото: в списках и заказах без полного списка. */
model CostumePhotoSummary {
  /** URL превью обложки (первое фото по порядку); нет фото — поле отсутствует. */
  coverThumbUrl?: string;
  photoCount: int32;
}

model CostumePhoto {
  id: int32;
  /** Публичный URL основного фото (~1600 px). */
  url: string;
  /** Публичный URL превью (~320 px). */
  thumbUrl: string;
  width: int32;
  height: int32;
}

@minValue(1)
@maxValue(10000)
scalar PhotoDimension extends int32;

model UploadCostumePhotoForm {
  /** Основное фото: image/jpeg или image/webp, до 2 МБ. */
  image: HttpPart<bytes>;
  /** Превью: image/jpeg или image/webp, до 200 КБ. */
  thumb: HttpPart<bytes>;
  /** Размеры основного фото в пикселях (текстовые поля формы). */
  width: HttpPart<PhotoDimension>;
  height: HttpPart<PhotoDimension>;
}

model ReorderCostumePhotosRequest {
  /** Все id активных фото костюма в новом порядке; первое — обложка. */
  @minItems(1) @maxItems(15) photoIds: int32[];
}

@route("/costumes/{costumeId}/photos")
interface CostumePhotoOperations {
  /** Загрузка через бэкенд, multipart/form-data. Лимит — 15 фото на костюм (409). */
  @post
  upload(
    @path costumeId: int32,
    @header contentType: "multipart/form-data",
    @multipartBody body: UploadCostumePhotoForm
  ): {
    @statusCode statusCode: 201;
    @body body: CostumePhoto;
  } | Common.Error;

  @get
  list(@path costumeId: int32): CostumePhoto[] | Common.Error;

  /** Объявлен до `{photoId}`: статический путь. */
  @patch
  @route("order")
  reorder(
    @path costumeId: int32,
    @body body: ReorderCostumePhotosRequest
  ): CostumePhoto[] | Common.Error;

  @delete
  @route("{photoId}")
  delete(@path costumeId: int32, @path photoId: int32): {
    @statusCode statusCode: 204;
  } | Common.Error;
}

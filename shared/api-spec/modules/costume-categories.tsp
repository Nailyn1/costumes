import "@typespec/http";
import "@typespec/rest";
import "../common/errors.tsp";

using Http;

namespace CostumeApp.CostumeCategories;

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

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CostumePhotosService } from '../costume-photos/costume-photos.service';
import {
  CostumeCategoryDto,
  CostumeCategoryNodeDto,
  CostumesAvailabilityResponseDto,
  CostumesListResponseDto,
  CostumesSearchAvailableResponseDto,
  CostumesSearchResponseDto,
  CreateCostumeCategoryRequestDto,
  CreateCostumesRequestDto,
  CreateUpdateCostumesResponseDto,
  findDuplicateCostumePart,
  normalizeCostumeParts,
  UpdateCostumeCategoryRequestDto,
  UpdateCostumesRequestDto,
} from '@costumes/shared';
import { Prisma } from '../prisma/generated/client';
import {
  buildExactTextFilter,
  buildIdentifierFilters,
  buildWordStartFilters,
  isSearchQueryReady,
  maxScore,
  mergeUniqueById,
  normalizeSearchQuery,
  scoreIdentifierMatch,
  scoreTextMatch,
  sortBySearchScore,
} from '../common/utils/search.utils';
import { toCostumeCatalogFields } from './costume.mapper';
import {
  assertHeightRange,
  buildCostumeFilterWhere,
  CostumeFilters,
} from './costume-filters';
import { CostumesRepository } from './costumes.repository';

@Injectable()
export class CostumesService {
  constructor(
    private readonly repo: CostumesRepository,
    private readonly photos: CostumePhotosService,
  ) {}

  // --- костюмы ---

  async createCostume(
    data: CreateCostumesRequestDto,
  ): Promise<CreateUpdateCostumesResponseDto> {
    assertHeightRange(data.heightFrom, data.heightTo);
    const parts = this.prepareParts(data.parts);
    if (data.categoryId != null) {
      await this.assertCategoryActive(data.categoryId);
    }

    const costume = await this.repo.create({
      name: data.name,
      categoryId: data.categoryId,
      gender: data.gender,
      heightFrom: data.heightFrom,
      heightTo: data.heightTo,
      sizeLabel: data.sizeLabel?.trim() || null,
      parts,
    });
    return {
      ...toCostumeCatalogFields(costume),
      photoCount: 0,
    };
  }

  async updateCostume(
    data: UpdateCostumesRequestDto,
    costumeId: number,
  ): Promise<CreateUpdateCostumesResponseDto> {
    if (data.heightFrom !== undefined || data.heightTo !== undefined) {
      // Диапазон проверяем вместе с тем, что уже сохранено
      const current = await this.repo.findHeightRange(costumeId);
      if (!current) {
        throw new NotFoundException(`Костюм с ID ${costumeId} не найден`);
      }
      assertHeightRange(
        data.heightFrom === undefined ? current.heightFrom : data.heightFrom,
        data.heightTo === undefined ? current.heightTo : data.heightTo,
      );
    }
    const parts = this.prepareParts(data.parts);
    if (data.categoryId != null) {
      await this.assertCategoryActive(data.categoryId);
    }

    const costume = await this.repo.update(costumeId, {
      name: data.name,
      categoryId: data.categoryId,
      gender: data.gender,
      heightFrom: data.heightFrom,
      heightTo: data.heightTo,
      sizeLabel:
        data.sizeLabel === undefined
          ? undefined
          : data.sizeLabel?.trim() || null,
      parts,
    });
    if (!costume) {
      throw new NotFoundException(`Костюм с ID ${costumeId} не найден`);
    }
    const summary = (await this.photos.summaries([costumeId])).get(costumeId);
    return {
      ...toCostumeCatalogFields(costume),
      photoCount: 0,
      ...summary,
    };
  }

  async deleteCostume(costumeId: number): Promise<void> {
    if (!(await this.repo.softDelete(costumeId))) {
      throw new NotFoundException(`Костюм с ID ${costumeId} не найден`);
    }
  }

  async searchCostume(
    q: string,
    filters: CostumeFilters = {},
  ): Promise<CostumesSearchResponseDto[]> {
    const search = normalizeSearchQuery(q);
    if (!isSearchQueryReady(search)) return [];
    const catalogWhere = buildCostumeFilterWhere(filters);

    const nameFilters = buildWordStartFilters(search);
    const identifierFilters = buildIdentifierFilters(search);

    const searchFilters: Prisma.CostumeWhereInput[] = [
      ...nameFilters.map((filter) => ({ name: filter })),
      ...identifierFilters.map((filter) => ({ inventoryCode: filter })),
      ...nameFilters.map((filter) => ({
        orders: {
          some: {
            deletedAt: null,
            child: { name: filter },
          },
        },
      })),
      ...identifierFilters.map((filter) => ({
        orders: {
          some: {
            deletedAt: null,
            visit: { visitCode: filter },
          },
        },
      })),
    ];

    const exactText = buildExactTextFilter(search);
    const exactFilters: Prisma.CostumeWhereInput[] = [
      { name: exactText },
      { inventoryCode: exactText },
      { orders: { some: { deletedAt: null, child: { name: exactText } } } },
      {
        orders: {
          some: { deletedAt: null, visit: { visitCode: exactText } },
        },
      },
    ];
    const [exactCostumes, broadCostumes] = await Promise.all([
      this.repo.searchWithOrders(
        { AND: [...catalogWhere, { OR: exactFilters }], deletedAt: null },
        20,
      ),
      this.repo.searchWithOrders(
        { AND: [...catalogWhere, { OR: searchFilters }], deletedAt: null },
        20,
      ),
    ]);
    const costumes = mergeUniqueById(exactCostumes, broadCostumes);

    const ranked = sortBySearchScore(costumes, (costume) =>
      maxScore([
        scoreTextMatch(costume.name, search),
        scoreIdentifierMatch(costume.inventoryCode, search),
        ...costume.orders.map((order) =>
          maxScore([
            scoreTextMatch(order.child.name, search),
            scoreIdentifierMatch(order.visit.visitCode, search),
          ]),
        ),
      ]),
    ).slice(0, 20);
    const summaries = await this.photos.summaries(ranked.map((c) => c.id));

    return ranked.map((c) => ({
      ...toCostumeCatalogFields(c),
      photoCount: 0,
      ...summaries.get(c.id),
      display: `${c.name} (${c.inventoryCode})`,
    }));
  }

  async searchCostumeAvailable(
    q: string,
    startStr: string,
    endStr: string,
    excludeVisitIdRaw?: string,
    filters: CostumeFilters = {},
  ): Promise<CostumesSearchAvailableResponseDto[]> {
    const search = normalizeSearchQuery(q);
    const catalogWhere = buildCostumeFilterWhere(filters);

    const requestedStart = new Date(startStr);
    const requestedEnd = new Date(endStr);

    if (isNaN(requestedStart.getTime()) || isNaN(requestedEnd.getTime())) {
      throw new BadRequestException(
        `Некорректный формат даты. Ожидался ISO 8601 (гггг-мм-ддTчч:мм). Получено: start=${startStr}, end=${endStr}`,
      );
    }

    if (requestedEnd <= requestedStart) {
      throw new BadRequestException(
        'Дата возврата должна быть строго позже даты выдачи',
      );
    }

    let excludeVisitId: number | undefined;
    if (excludeVisitIdRaw !== undefined) {
      excludeVisitId = Number(excludeVisitIdRaw);
      if (!Number.isSafeInteger(excludeVisitId) || excludeVisitId < 1) {
        throw new BadRequestException('Некорректный ID визита');
      }
      const visit = await this.repo.findActiveVisit(excludeVisitId);
      if (!visit) {
        throw new NotFoundException(`Визит с ID ${excludeVisitId} не найден`);
      }
      if (visit.status !== 'reserved') {
        throw new BadRequestException(
          'Исключать из проверки доступности можно только бронь со статусом «забронирован»',
        );
      }
    }

    if (!isSearchQueryReady(search)) return [];

    const searchFilters: Prisma.CostumeWhereInput[] = [
      ...buildWordStartFilters(search).map((filter) => ({ name: filter })),
      ...buildIdentifierFilters(search).map((filter) => ({
        inventoryCode: filter,
      })),
    ];

    const busyOrders = {
      where: {
        deletedAt: null,
        status: { in: ['reserved', 'issued'] },
        visit: {
          deletedAt: null,
          status: { not: 'cancelled' },
          ...(excludeVisitId === undefined
            ? {}
            : { id: { not: excludeVisitId } }),
          AND: [
            { startDateTime: { lt: requestedEnd } },
            { endDateTime: { gt: requestedStart } },
          ],
        },
      },
      include: {
        visit: true,
      },
    } satisfies Prisma.CostumeInclude['orders'];
    const exactText = buildExactTextFilter(search);
    const [exactCostumes, broadCostumes] = await Promise.all([
      this.repo.searchWithBusyOrders(
        {
          AND: [
            ...catalogWhere,
            { OR: [{ name: exactText }, { inventoryCode: exactText }] },
          ],
          deletedAt: null,
        },
        30,
        busyOrders,
      ),
      this.repo.searchWithBusyOrders(
        { AND: [...catalogWhere, { OR: searchFilters }], deletedAt: null },
        30,
        busyOrders,
      ),
    ]);
    const costumes = mergeUniqueById(exactCostumes, broadCostumes);

    const ranked = sortBySearchScore(costumes, (costume) =>
      maxScore([
        scoreTextMatch(costume.name, search),
        scoreIdentifierMatch(costume.inventoryCode, search),
      ]),
    ).slice(0, 30);
    const summaries = await this.photos.summaries(ranked.map((c) => c.id));

    return ranked.map((c) => ({
      ...toCostumeCatalogFields(c),
      photoCount: 0,
      ...summaries.get(c.id),
      status: c.orders.length > 0 ? 'issued' : 'available',
    }));
  }

  async costumesAvailability(
    costumeId: number,
  ): Promise<CostumesAvailabilityResponseDto> {
    const costume = await this.repo.findWithActiveOrders(costumeId);

    if (!costume) {
      throw new NotFoundException(`Костюм с ID ${costumeId} не найден`);
    }

    const periods = costume.orders.map((order) => {
      if (!order.client || !order.child) {
        console.warn(
          `Данные повреждены для заказа ID: ${order.id}. Отсутствует клиент или ребенок.`,
        );
      }

      return {
        visitCode: order.visit.visitCode,
        childName: order.child?.name || 'Имя не указано',
        clientPhone: order.client?.phone || 'Телефон не указан',
        clientName: order.client?.name,
        startDateTime: order.startDateTime.toISOString().split('T')[0],
        endDateTime: order.endDateTime.toISOString().split('T')[0],
        issueTimeFrom: order.visit.issueTimeFrom,
        returnTimeUntil: order.visit.returnTimeUntil,
      };
    });

    const summary = (await this.photos.summaries([costume.id])).get(costume.id);

    return {
      ...toCostumeCatalogFields(costume),
      photoCount: 0,
      ...summary,
      periods: periods,
      noPeriodsMessage:
        periods.length === 0
          ? 'На выбранный костюм активных броней не найдено'
          : null,
    };
  }

  async getCostumesList(
    page: number = 1,
    limit: number = 20,
    filters: CostumeFilters = {},
  ): Promise<CostumesListResponseDto> {
    const skip = (page - 1) * limit;

    const [rawItems, total] = await this.repo.listPage(
      { deletedAt: null, AND: buildCostumeFilterWhere(filters) },
      skip,
      limit,
    );

    const summaries = await this.photos.summaries(rawItems.map((i) => i.id));
    const items = rawItems.map((item) => ({
      ...toCostumeCatalogFields(item),
      photoCount: 0,
      ...summaries.get(item.id),
    }));

    return {
      items,
      total,
      page,
      limit,
      hasMore: skip + items.length < total,
    };
  }

  // --- справочник категорий ---

  async listCategories(): Promise<CostumeCategoryNodeDto[]> {
    const roots = await this.repo.listRootCategories();
    return roots.map((root) => ({
      id: root.id,
      name: root.name,
      sortOrder: root.sortOrder,
      children: root.children.map((child) => ({
        id: child.id,
        name: child.name,
        sortOrder: child.sortOrder,
      })),
    }));
  }

  async createCategory(
    data: CreateCostumeCategoryRequestDto,
  ): Promise<CostumeCategoryDto> {
    const name = data.name.trim();
    const parentId = data.parentId ?? null;

    if (parentId !== null) {
      const parent = await this.repo.findActiveCategory(parentId);
      if (!parent) {
        throw new NotFoundException(`Категория с ID ${parentId} не найдена`);
      }
      if (parent.parentId !== null) {
        throw new BadRequestException(
          'Подкатегорию нельзя создать внутри другой подкатегории',
        );
      }
    }

    await this.assertCategoryNameFree(name, parentId);

    const last = await this.repo.lastCategorySortOrder(parentId);
    return this.toCategoryDto(
      await this.repo.createCategory({ name, parentId, sortOrder: last + 1 }),
    );
  }

  async updateCategory(
    categoryId: number,
    data: UpdateCostumeCategoryRequestDto,
  ): Promise<CostumeCategoryDto> {
    const category = await this.findActiveCategory(categoryId);
    const name = data.name?.trim();

    if (name !== undefined && name !== category.name) {
      await this.assertCategoryNameFree(name, category.parentId, categoryId);
    }

    return this.toCategoryDto(
      await this.repo.updateCategory(categoryId, {
        name,
        sortOrder: data.sortOrder,
      }),
    );
  }

  async deleteCategory(categoryId: number): Promise<void> {
    await this.findActiveCategory(categoryId);

    if ((await this.repo.countActiveSubcategories(categoryId)) > 0) {
      throw new ConflictException(
        'Нельзя удалить категорию, пока в ней есть подкатегории',
      );
    }
    await this.repo.softDeleteCategory(categoryId);
  }

  // --- вспомогательное ---

  /** Нормализует состав из запроса; `undefined` — состав не меняем. */
  private prepareParts(
    parts: CreateCostumesRequestDto['parts'],
  ): { name: string; qty: number }[] | undefined {
    if (parts === undefined) return undefined;
    const normalized = normalizeCostumeParts(parts);
    if (normalized.length !== parts.length) {
      throw new BadRequestException(
        'Название части состава не может быть пустым',
      );
    }
    const duplicate = findDuplicateCostumePart(normalized);
    if (duplicate !== null) {
      throw new BadRequestException(
        `Часть «${duplicate}» указана в составе дважды`,
      );
    }
    return normalized;
  }

  private async assertCategoryActive(categoryId: number): Promise<void> {
    if (!(await this.repo.categoryExists(categoryId))) {
      throw new BadRequestException(`Категория с ID ${categoryId} не найдена`);
    }
  }

  private async findActiveCategory(categoryId: number) {
    const category = await this.repo.findActiveCategory(categoryId);
    if (!category) {
      throw new NotFoundException(`Категория с ID ${categoryId} не найдена`);
    }
    return category;
  }

  private async assertCategoryNameFree(
    name: string,
    parentId: number | null,
    exceptId?: number,
  ): Promise<void> {
    if (await this.repo.categoryNameTaken(name, parentId, exceptId)) {
      throw new ConflictException(`Категория «${name}» уже существует`);
    }
  }

  private toCategoryDto(category: {
    id: number;
    name: string;
    parentId: number | null;
    sortOrder: number;
  }): CostumeCategoryDto {
    return {
      id: category.id,
      name: category.name,
      parentId: category.parentId,
      sortOrder: category.sortOrder,
    };
  }
}

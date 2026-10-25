import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CostumesAvailabilityResponseDto,
  CostumesListResponseDto,
  CostumesSearchAvailableResponseDto,
  CostumesSearchResponseDto,
  CreateCostumesRequestDto,
  CreateUpdateCostumesResponseDto,
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
import {
  costumeCatalogInclude,
  toCostumeCatalogFields,
} from './costume.mapper';
import {
  findDuplicateCostumePart,
  normalizeCostumeParts,
} from '@costumes/shared';
import {
  assertHeightRange,
  buildCostumeFilterWhere,
  CostumeFilters,
} from './costume-filters';

@Injectable()
export class CostumesService {
  constructor(private readonly prisma: PrismaService) {}

  async createCostume(
    data: CreateCostumesRequestDto,
  ): Promise<CreateUpdateCostumesResponseDto> {
    assertHeightRange(data.heightFrom, data.heightTo);
    const parts = this.prepareParts(data.parts);
    if (data.categoryId != null) {
      await this.assertCategoryActive(data.categoryId);
    }

    const costume = await this.prisma.costume.create({
      data: {
        name: data.name,
        categoryId: data.categoryId,
        gender: data.gender,
        heightFrom: data.heightFrom,
        heightTo: data.heightTo,
        sizeLabel: data.sizeLabel?.trim() || null,
        parts,
      },
      include: costumeCatalogInclude,
    });
    return toCostumeCatalogFields(costume);
  }

  async updateCostume(
    data: UpdateCostumesRequestDto,
    costumeId: number,
  ): Promise<CreateUpdateCostumesResponseDto> {
    if (data.heightFrom !== undefined || data.heightTo !== undefined) {
      // Диапазон проверяем вместе с тем, что уже сохранено
      const current = await this.prisma.costume.findFirst({
        where: { id: costumeId, deletedAt: null },
        select: { heightFrom: true, heightTo: true },
      });
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

    const costume = await this.prisma.costume
      .update({
        where: { id: costumeId, deletedAt: null },
        data: {
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
        },
        include: costumeCatalogInclude,
      })
      .catch((err) => {
        if (err.code === 'P2025') {
          throw new NotFoundException(`Костюм с ID ${costumeId} не найден`);
        }
        throw err;
      });

    return toCostumeCatalogFields(costume);
  }

  async deleteCostume(costumeId: number): Promise<void> {
    await this.prisma.costume
      .update({
        where: { id: costumeId, deletedAt: null },
        data: { deletedAt: new Date() },
      })
      .catch(() => {
        throw new NotFoundException(`Костюм с ID ${costumeId} не найден`);
      });
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

    const include = {
      ...costumeCatalogInclude,
      orders: {
        where: { deletedAt: null },
        include: {
          child: true,
          visit: true,
        },
      },
    } satisfies Prisma.CostumeInclude;
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
      this.prisma.costume.findMany({
        where: {
          AND: [...catalogWhere, { OR: exactFilters }],
          deletedAt: null,
        },
        include,
        take: 20,
      }),
      this.prisma.costume.findMany({
        where: {
          AND: [...catalogWhere, { OR: searchFilters }],
          deletedAt: null,
        },
        include,
        take: 20,
      }),
    ]);
    const costumes = mergeUniqueById(exactCostumes, broadCostumes);

    return sortBySearchScore(costumes, (costume) =>
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
    )
      .slice(0, 20)
      .map((c) => ({
        ...toCostumeCatalogFields(c),
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
      const visit = await this.prisma.visit.findFirst({
        where: { id: excludeVisitId, deletedAt: null },
        select: { id: true, status: true },
      });
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

    const include = {
      ...costumeCatalogInclude,
      orders: {
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
      },
    } satisfies Prisma.CostumeInclude;
    const exactText = buildExactTextFilter(search);
    const [exactCostumes, broadCostumes] = await Promise.all([
      this.prisma.costume.findMany({
        where: {
          AND: [
            ...catalogWhere,
            { OR: [{ name: exactText }, { inventoryCode: exactText }] },
          ],
          deletedAt: null,
        },
        include,
        take: 30,
      }),
      this.prisma.costume.findMany({
        where: {
          AND: [...catalogWhere, { OR: searchFilters }],
          deletedAt: null,
        },
        include,
        take: 30,
      }),
    ]);
    const costumes = mergeUniqueById(exactCostumes, broadCostumes);

    return sortBySearchScore(costumes, (costume) =>
      maxScore([
        scoreTextMatch(costume.name, search),
        scoreIdentifierMatch(costume.inventoryCode, search),
      ]),
    )
      .slice(0, 30)
      .map((c) => ({
        ...toCostumeCatalogFields(c),
        status: c.orders.length > 0 ? 'issued' : 'available',
      }));
  }

  async costumesAvailability(
    costumeId: number,
  ): Promise<CostumesAvailabilityResponseDto> {
    const costume = await this.prisma.costume.findUnique({
      where: {
        id: costumeId,
        deletedAt: null,
      },
      include: {
        ...costumeCatalogInclude,
        orders: {
          where: {
            status: { in: ['reserved', 'issued'] },
            deletedAt: null,
            visit: {
              deletedAt: null,
              status: { not: 'cancelled' },
            },
          },
          include: {
            visit: true,
            child: true,
            client: true,
          },
          orderBy: {
            startDateTime: 'asc',
          },
        },
      },
    });

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

    return {
      ...toCostumeCatalogFields(costume),
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

    const whereCondition: Prisma.CostumeWhereInput = {
      deletedAt: null,
      AND: buildCostumeFilterWhere(filters),
    };

    const [rawItems, total] = await this.prisma.$transaction([
      this.prisma.costume.findMany({
        where: whereCondition,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          inventoryCode: true,
          gender: true,
          heightFrom: true,
          heightTo: true,
          sizeLabel: true,
          parts: true,
          category: costumeCatalogInclude.category,
        },
        orderBy: {
          id: 'desc',
        },
      }),
      this.prisma.costume.count({
        where: whereCondition,
      }),
    ]);

    const items = rawItems.map(toCostumeCatalogFields);

    return {
      items,
      total,
      page,
      limit,
      hasMore: skip + items.length < total,
    };
  }

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
    const category = await this.prisma.costumeCategory.findFirst({
      where: { id: categoryId, deletedAt: null },
      select: { id: true },
    });
    if (!category) {
      throw new BadRequestException(`Категория с ID ${categoryId} не найдена`);
    }
  }
}

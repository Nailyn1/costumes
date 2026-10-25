import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CostumePhotosService } from '../costume-photos/costume-photos.service';
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

@Injectable()
export class CostumesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly photos: CostumePhotosService,
  ) {}

  async createCostume(
    data: CreateCostumesRequestDto,
  ): Promise<CreateUpdateCostumesResponseDto> {
    const costume = await this.prisma.costume.create({ data });
    const response = {
      costumeId: costume.id,
      name: costume.name,
      inventoryCode: costume.inventoryCode,
      photoCount: 0,
    };
    return response;
  }

  async updateCostume(
    data: UpdateCostumesRequestDto,
    costumeId: number,
  ): Promise<CreateUpdateCostumesResponseDto> {
    const costume = await this.prisma.costume
      .update({
        where: { id: costumeId, deletedAt: null },
        data: {
          name: data.name,
        },
      })
      .catch((err) => {
        if (err.code === 'P2025') {
          throw new NotFoundException(`Костюм с ID ${costumeId} не найден`);
        }
        throw err;
      });

    const { name, inventoryCode } = costume;
    const summary = (await this.photos.summaries([costumeId])).get(costumeId);
    return {
      costumeId,
      name,
      inventoryCode,
      photoCount: 0,
      ...summary,
    };
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

  async searchCostume(q: string): Promise<CostumesSearchResponseDto[]> {
    const search = normalizeSearchQuery(q);
    if (!isSearchQueryReady(search)) return [];

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
        where: { OR: exactFilters, deletedAt: null },
        include,
        take: 20,
      }),
      this.prisma.costume.findMany({
        where: { OR: searchFilters, deletedAt: null },
        include,
        take: 20,
      }),
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
      costumeId: c.id,
      name: c.name,
      inventoryCode: c.inventoryCode,
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
  ): Promise<CostumesSearchAvailableResponseDto[]> {
    const search = normalizeSearchQuery(q);

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
          OR: [{ name: exactText }, { inventoryCode: exactText }],
          deletedAt: null,
        },
        include,
        take: 30,
      }),
      this.prisma.costume.findMany({
        where: { OR: searchFilters, deletedAt: null },
        include,
        take: 30,
      }),
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
      costumeId: c.id,
      name: c.name,
      inventoryCode: c.inventoryCode,
      photoCount: 0,
      ...summaries.get(c.id),
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

    const summary = (await this.photos.summaries([costume.id])).get(costume.id);

    return {
      costumeId: costume.id,
      name: costume.name,
      inventoryCode: costume.inventoryCode,
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
  ): Promise<CostumesListResponseDto> {
    const skip = (page - 1) * limit;

    const whereCondition = {
      deletedAt: null,
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
        },
        orderBy: {
          id: 'desc',
        },
      }),
      this.prisma.costume.count({
        where: whereCondition,
      }),
    ]);

    const summaries = await this.photos.summaries(rawItems.map((i) => i.id));
    const items = rawItems.map((item) => ({
      costumeId: item.id,
      name: item.name,
      inventoryCode: item.inventoryCode,
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
}

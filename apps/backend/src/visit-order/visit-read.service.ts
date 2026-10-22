import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PaginatedVisitsResponseDto,
  PaginatedVisitsResponseSchema,
  VisitListQueryDto,
  VisitReadDetailDto,
  VisitReadDetailSchema,
} from '@costumes/shared';
import { Prisma } from '../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { calculateVisitBalance } from './domain/visit-balance';
import {
  buildIdentifierFilters,
  buildPhoneFilters,
  buildWordStartFilters,
  isSearchQueryReady,
  normalizeSearchQuery,
} from '../common/utils/search.utils';

const VISIT_STATUSES = [
  'reserved',
  'issued',
  'completed',
  'cancelled',
] as const;

type VisitListQueryInput = Omit<VisitListQueryDto, 'status'> & {
  status?: string;
};

@Injectable()
export class VisitReadService {
  constructor(private readonly prisma: PrismaService) {}

  private optionalQueryString(value: unknown): string | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== 'string') {
      throw new BadRequestException(
        'Параметры запроса должны передаваться по одному значению',
      );
    }
    return value;
  }

  private parseDay(value: string, endOfDay: boolean): Date {
    const time = endOfDay ? '23:59:59.999' : '00:00:00.000';
    const result = new Date(`${value}T${time}Z`);
    if (
      Number.isNaN(result.getTime()) ||
      result.toISOString().slice(0, 10) !== value
    ) {
      throw new BadRequestException(
        'Укажите корректную дату в формате YYYY-MM-DD',
      );
    }
    return result;
  }

  private assertValidQuery(query: VisitListQueryInput): void {
    const { page = 1, limit = 20, status } = query;
    this.optionalQueryString(query.q);
    this.optionalQueryString(query.status);
    this.optionalQueryString(query.startDateFrom);
    this.optionalQueryString(query.startDateTo);
    this.optionalQueryString(query.endDateFrom);
    this.optionalQueryString(query.endDateTo);
    if (!Number.isInteger(page) || page < 1) {
      throw new BadRequestException('Номер страницы должен быть не меньше 1');
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException('Размер страницы должен быть от 1 до 100');
    }
    if (status && !VISIT_STATUSES.some((allowed) => allowed === status)) {
      throw new BadRequestException('Указан неизвестный статус визита');
    }
    if (query.q !== undefined && query.q.length < 2) {
      throw new BadRequestException(
        'Поисковый запрос должен содержать не менее 2 символов',
      );
    }
    if (
      query.startDateFrom &&
      query.startDateTo &&
      query.startDateFrom > query.startDateTo
    ) {
      throw new BadRequestException(
        'Дата «Выдача по» не может быть раньше даты «Выдача с»',
      );
    }
    if (
      query.endDateFrom &&
      query.endDateTo &&
      query.endDateFrom > query.endDateTo
    ) {
      throw new BadRequestException(
        'Дата «Возврат по» не может быть раньше даты «Возврат с»',
      );
    }
  }

  private buildSearchWhere(q: string): Prisma.VisitWhereInput[] {
    const search = normalizeSearchQuery(q);
    if (!isSearchQueryReady(search)) return [];

    const wordFilters = buildWordStartFilters(search);
    const identifierFilters = buildIdentifierFilters(search);
    const phoneFilters = buildPhoneFilters(search);
    return [
      ...identifierFilters.map((filter) => ({ visitCode: filter })),
      ...wordFilters.map((filter) => ({ client: { name: filter } })),
      ...phoneFilters.map((filter) => ({ client: { phone: filter } })),
      ...wordFilters.map((filter) => ({
        orders: {
          some: {
            deletedAt: null,
            OR: [{ child: { name: filter } }, { costume: { name: filter } }],
          },
        },
      })),
      ...identifierFilters.map((filter) => ({
        orders: {
          some: {
            deletedAt: null,
            costume: { inventoryCode: filter },
          },
        },
      })),
    ];
  }

  async list(query: VisitListQueryInput): Promise<PaginatedVisitsResponseDto> {
    this.assertValidQuery(query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const q = this.optionalQueryString(query.q);
    const queryStatus = this.optionalQueryString(query.status);
    const startDateFrom = this.optionalQueryString(query.startDateFrom);
    const startDateTo = this.optionalQueryString(query.startDateTo);
    const endDateFrom = this.optionalQueryString(query.endDateFrom);
    const endDateTo = this.optionalQueryString(query.endDateTo);
    const where: Prisma.VisitWhereInput = { deletedAt: null };

    if (queryStatus) {
      const status = VISIT_STATUSES.find((allowed) => allowed === queryStatus);
      if (status) where.status = status;
    }
    if (startDateFrom || startDateTo) {
      where.startDateTime = {
        ...(startDateFrom ? { gte: this.parseDay(startDateFrom, false) } : {}),
        ...(startDateTo ? { lte: this.parseDay(startDateTo, true) } : {}),
      };
    }
    if (endDateFrom || endDateTo) {
      where.endDateTime = {
        ...(endDateFrom ? { gte: this.parseDay(endDateFrom, false) } : {}),
        ...(endDateTo ? { lte: this.parseDay(endDateTo, true) } : {}),
      };
    }
    if (q) {
      const searchFilters = this.buildSearchWhere(q);
      if (searchFilters.length === 0) {
        return PaginatedVisitsResponseSchema.parse({
          items: [],
          total: 0,
          page,
          limit,
          hasMore: false,
        });
      }
      where.OR = searchFilters;
    }

    const skip = (page - 1) * limit;
    const [visits, total] = await Promise.all([
      this.prisma.visit.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          client: { select: { id: true, name: true, phone: true } },
          orders: {
            where: { deletedAt: null },
            include: {
              child: { select: { name: true } },
              costume: { select: { name: true, inventoryCode: true } },
            },
          },
        },
      }),
      this.prisma.visit.count({ where }),
    ]);

    return PaginatedVisitsResponseSchema.parse({
      items: visits.map((visit) => {
        const totalRent = visit.orders.reduce(
          (sum, order) => sum + order.rentPrice,
          0,
        );
        const totalPrepayment = visit.orders.reduce(
          (sum, order) => sum + order.prepaymentAmount,
          0,
        );
        return {
          id: visit.id,
          visitCode: visit.visitCode,
          status: visit.status,
          client: visit.client,
          startDateTime: visit.startDateTime.toISOString().slice(0, 10),
          endDateTime: visit.endDateTime.toISOString().slice(0, 10),
          issueTimeFrom: visit.issueTimeFrom,
          issueTimeTo: visit.issueTimeTo,
          returnTimeUntil: visit.returnTimeUntil,
          childrenNames: Array.from(
            new Set(visit.orders.map((order) => order.child.name)),
          ).join(', '),
          costumesNames: visit.orders
            .map((order) => order.costume.name)
            .join(', '),
          orderCount: visit.orders.length,
          totalRent,
          totalPrepayment,
          totalRemaining: totalRent - totalPrepayment,
          createdAt: visit.createdAt.toISOString(),
        };
      }),
      total,
      page,
      limit,
      hasMore: skip + visits.length < total,
    });
  }

  async detail(visitId: number): Promise<VisitReadDetailDto> {
    const visit = await this.prisma.visit.findFirst({
      where: { id: visitId, deletedAt: null },
      include: {
        client: { select: { id: true, name: true, phone: true } },
        orders: {
          where: { deletedAt: null },
          include: {
            child: { select: { name: true } },
            costume: { select: { name: true, inventoryCode: true } },
          },
        },
        moneyOperations: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        },
        deposits: {
          where: { deletedAt: null },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        },
      },
    });
    if (!visit) {
      throw new NotFoundException(`Визит с ID ${visitId} не найден`);
    }

    const totalRent = visit.orders.reduce(
      (sum, order) => sum + order.rentPrice,
      0,
    );
    const totalPrepayment = visit.orders.reduce(
      (sum, order) => sum + order.prepaymentAmount,
      0,
    );
    const balance =
      visit.status === 'issued' || visit.status === 'completed'
        ? calculateVisitBalance({
            orders: visit.orders,
            operations: visit.moneyOperations,
          })
        : undefined;

    return VisitReadDetailSchema.parse({
      id: visit.id,
      visitCode: visit.visitCode,
      status: visit.status,
      version: visit.version,
      client: visit.client,
      startDateTime: visit.startDateTime.toISOString().slice(0, 10),
      endDateTime: visit.endDateTime.toISOString().slice(0, 10),
      issueTimeFrom: visit.issueTimeFrom,
      issueTimeTo: visit.issueTimeTo,
      returnTimeUntil: visit.returnTimeUntil,
      ...(visit.notes === null ? {} : { notes: visit.notes }),
      createdAt: visit.createdAt.toISOString(),
      orders: visit.orders.map((order) => ({
        orderId: order.id,
        childId: order.childId,
        childName: order.child.name,
        costumeId: order.costumeId,
        costumeName: order.costume.name,
        inventoryCode: order.costume.inventoryCode,
        status: order.status,
        tagStatus: order.tagStatus,
        rentPrice: order.rentPrice,
        prepaymentAmount: order.prepaymentAmount,
        ...(order.finalPayment === null
          ? {}
          : { finalPayment: order.finalPayment }),
        ...(order.notes === null ? {} : { notes: order.notes }),
      })),
      moneyOperations: visit.moneyOperations.map((operation) => ({
        id: operation.id,
        kind: operation.kind,
        amount: operation.amount,
        createdAt: operation.createdAt.toISOString(),
        legacyImported: operation.legacyImported,
        ...(operation.voidedAt === null
          ? {}
          : { voidedAt: operation.voidedAt.toISOString() }),
      })),
      deposits: visit.deposits.map((deposit) => ({
        id: deposit.id,
        type: deposit.type,
        ...(deposit.amount === null ? {} : { amount: deposit.amount }),
        returned: deposit.returned,
        createdAt: deposit.createdAt.toISOString(),
      })),
      totals: {
        totalRent,
        totalPrepayment,
        totalRemaining: totalRent - totalPrepayment,
      },
      ...(balance ? { balance } : {}),
    });
  }
}

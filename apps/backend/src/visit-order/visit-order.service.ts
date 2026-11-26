import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { PrismaService } from '../prisma/prisma.service';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import {
  CreateVisitRequestDto,
  CreateVisitResponseDto,
  CreateVisitResponseSchema,
  QuickIssueVisitRequestDto,
  QuickIssueVisitResponseDto,
  QuickIssueVisitResponseSchema,
  GetVisitForIssueDto,
  GetVisitReservedDto,
  GetVisitReturnSearchDto,
  GetVisitSearchDto,
  GetVisitsForReturnDto,
  IssuedForReturnDto,
  MarkDepositReturnedDto,
  OrdersNotWrittenResponseDto,
  OrdersNotWrittenResponseSchema,
  PaginatedUnsettledVisitBalancesResponseDto,
  searchNotificationDto,
  VisitBalanceDto,
  visitCancelRequestDto,
  visitCompleteReturnRequestDto,
  visitCompleteReturnResponseDto,
  visitIssuedResponseDto,
  VisitIssueRequestDto,
  VisitSettlementRequestDto,
  visitNotificationResponseDto,
  VisitHistoryPayloadDto,
  VisitHistoryPayloadSchema,
  VisitHistoryEventSchema,
  PaginatedVisitHistoryResponseDto,
  PaginatedVisitHistoryResponseSchema,
  UpdateReservedVisitRequestDto,
  UpdateReservedVisitResponseDto,
  UpdateReservedVisitResponseSchema,
  AddAndIssueVisitRequestDto,
  AddAndIssueVisitResponseDto,
  AddAndIssueVisitResponseSchema,
} from '@costumes/shared';
import { OrderStatus, Prisma, VisitStatus } from '../prisma/generated/client';
import { randomUUID } from 'node:crypto';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { buildVisitMessage } from '../common/utils/visit-message.utils';
import {
  buildExactPhoneFilter,
  buildExactTextFilter,
  buildIdentifierFilters,
  buildPhoneFilters,
  buildWordStartFilters,
  isSearchQueryReady,
  maxScore,
  mergeUniqueById,
  normalizeSearchQuery,
  scoreIdentifierMatch,
  scorePhoneMatch,
  scoreTextMatch,
  sortBySearchScore,
} from '../common/utils/search.utils';
import {
  orderCostumeParts,
  parseCostumeParts,
} from '../common/utils/costume-parts';
import {
  isSameCostumePartName,
  type ReturnMissingPartsDto,
} from '@costumes/shared';
import {
  calculateVisitBalance,
  validateVisitSettlement,
  VisitBalanceError,
  type VisitBalance,
  type VisitMoneyOperationInput,
  type VisitSettlementKind,
} from './domain/visit-balance';
import { Visit, VisitRuleError, type VisitSnapshot } from './domain/visit';
import {
  isSerializationConflict,
  runSerializableTransaction,
} from './transactions/serializable-transaction';
import {
  executeWithCommandReceipt,
  hashCommandRequest,
} from './transactions/command-receipt';
import { readVisitDetail } from './visit-read.mapper';
import { CostumePhotosService } from '../costume-photos/costume-photos.service';

const VISIT_ISSUE_REJECT_MESSAGES: Record<
  Exclude<VisitStatus, 'reserved'>,
  string
> = {
  issued: 'Визит уже выдан — повторно выдать костюмы нельзя',
  completed: 'Визит уже завершён, костюмы возвращены — выдать их нельзя',
  cancelled: 'Бронь отменена — выдать костюмы по отменённому визиту нельзя',
};

interface PinoLoggerWithId {
  id?: string;
}

export type VisitAuditActor =
  { source: 'user'; userId: number } | { source: 'system' };

type VisitAuditAction = VisitHistoryPayloadDto['kind'];
type VisitAuditEventInput = {
  [Action in VisitAuditAction]: {
    action: Action;
    entityType: 'visit' | 'order';
    entityId: number;
    visitId: number;
    orderId?: number;
    payload: Extract<VisitHistoryPayloadDto, { kind: Action }>;
  };
}[VisitAuditAction];

type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function toJsonValue(value: unknown): JsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (Array.isArray(value)) return value.map(toJsonValue);
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, toJsonValue(child)]),
    );
  }
  throw new InternalServerErrorException('Некорректные данные истории визита');
}

@Injectable()
export class VisitOrderService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectQueue('notifications') private readonly notificationQueue: Queue,
    private readonly prisma: PrismaService,
    @InjectPinoLogger(VisitOrderService.name)
    private readonly logger: PinoLogger,
    private readonly photos: CostumePhotosService,
  ) {}

  private async withSerializableTransaction<TResult>(
    operation: (tx: Prisma.TransactionClient) => Promise<TResult>,
  ): Promise<TResult> {
    try {
      return await runSerializableTransaction<
        Prisma.TransactionClient,
        TResult
      >(this.prisma.$transaction.bind(this.prisma), operation);
    } catch (error: unknown) {
      if (isSerializationConflict(error)) {
        throw new ConflictException(
          'Данные визита изменились. Обновите данные и повторите попытку',
        );
      }
      throw error;
    }
  }

  private async updateVisitWithVersion(
    tx: Prisma.TransactionClient,
    visitId: number,
    expectedVersion: number,
    data: Prisma.VisitUpdateManyMutationInput = {},
  ): Promise<void> {
    const updated = await tx.visit.updateMany({
      where: { id: visitId, version: expectedVersion, deletedAt: null },
      data: { ...data, version: { increment: 1 } },
    });
    if (updated.count !== 1) {
      throw new ConflictException(
        'Визит изменён другим сотрудником. Обновите данные и повторите действие',
      );
    }
  }

  private async recordAuditEvents(
    tx: Prisma.TransactionClient,
    actor: VisitAuditActor,
    commandId: string,
    events: VisitAuditEventInput[],
  ): Promise<void> {
    const actorUser =
      actor.source === 'user'
        ? await tx.user.findUnique({
            where: { id: actor.userId },
            select: { id: true, name: true },
          })
        : null;
    if (actor.source === 'user' && !actorUser) {
      throw new NotFoundException('Сотрудник из токена не найден');
    }
    const actorUserId = actorUser?.id ?? null;
    const actorNameSnapshot = actorUser?.name ?? 'Система';

    for (const event of events) {
      const payload = VisitHistoryPayloadSchema.parse(event.payload);
      if (payload.kind !== event.action) {
        throw new InternalServerErrorException(
          'Тип события не совпадает с данными истории визита',
        );
      }
      const payloadJson = toJsonValue(payload);
      if (payloadJson === null || Array.isArray(payloadJson)) {
        throw new InternalServerErrorException(
          'Некорректные данные истории визита',
        );
      }
      await tx.auditEvent.create({
        data: {
          actorUserId,
          actorNameSnapshot,
          source: actor.source,
          action: event.action,
          entityType: event.entityType,
          entityId: event.entityId,
          visitId: event.visitId,
          orderId: event.orderId,
          commandId,
          schemaVersion: 1,
          payload: payloadJson,
        },
      });
    }
  }

  private parseDateTime(dateStr: string, timeStr: string): Date {
    return new Date(`${dateStr}T${timeStr}:00Z`);
  }

  private assertValidSettlement(
    balance: VisitBalance,
    settlement: { kind: VisitSettlementKind; amount: number },
  ): void {
    try {
      validateVisitSettlement(balance, settlement.kind, settlement.amount);
    } catch (error) {
      if (!(error instanceof VisitBalanceError)) throw error;
      const messages: Record<VisitBalanceError['code'], string> = {
        INVALID_AMOUNT: 'Сумма расчёта должна быть положительным целым числом',
        NO_DEBT: 'У визита нет долга для оплаты',
        NO_REFUND_DUE: 'У визита нет переплаты для возврата',
        EXCEEDS_BALANCE: 'Сумма превышает текущий долг или переплату',
      };
      throw new BadRequestException(messages[error.code]);
    }
  }

  private visitDomain(
    snapshot: Omit<VisitSnapshot, 'moneyOperations'> & {
      moneyOperations: ReadonlyArray<VisitMoneyOperationInput>;
    },
  ): Visit {
    return Visit.from({
      ...snapshot,
      moneyOperations: snapshot.moneyOperations.map((operation) => ({
        kind: operation.kind,
        amount: operation.amount,
        voided: Boolean(operation.voidedAt),
      })),
    });
  }

  private rethrowVisitRule(error: unknown): never {
    if (!(error instanceof VisitRuleError)) throw error;
    switch (error.code) {
      case 'START_AFTER_RETURN':
        throw new BadRequestException(
          'Дата начала не может быть позже даты возврата',
        );
      case 'DUPLICATE_COSTUME':
        throw new BadRequestException(
          'Бронирование невозможно: один костюм указан в нескольких заказах одного визита',
        );
      case 'PREPAYMENT_EXCEEDS_RENT':
        throw new BadRequestException(
          `Цена аренды (${error.context.rentPrice}) не может быть меньше предоплаты (${error.context.prepaymentAmount})`,
        );
      case 'INVALID_ISSUE_PAYMENT':
        throw new BadRequestException(
          'Доплата должна быть неотрицательной суммой',
        );
      case 'CANNOT_ISSUE':
        throw new BadRequestException(
          VISIT_ISSUE_REJECT_MESSAGES[
            error.context.status as Exclude<VisitStatus, 'reserved'>
          ],
        );
      case 'CANNOT_ADD_AND_ISSUE':
        throw new BadRequestException(
          'Добавлять и выдавать костюмы можно только в уже выданный визит',
        );
      case 'CANNOT_UNISSUE':
        throw new BadRequestException(
          'Отменить выдачу можно только для визита со статусом "Выдан" (issued)',
        );
      case 'CANNOT_COMPLETE_RETURN':
        throw new BadRequestException('Завершить можно только выданный визит');
      case 'ORDERS_NOT_ISSUED':
        throw new BadRequestException(
          'Нельзя завершить визит: не все заказы в этом визите имеют статус "Выдан"',
        );
      case 'CANNOT_CANCEL':
        throw new BadRequestException(
          `Невозможно отменить визит в статусе "${error.context.status}". Отмена доступна только для статуса "reserved".`,
        );
      case 'BALANCE_NOT_AVAILABLE':
        throw new BadRequestException('Баланс доступен после выдачи визита');
      case 'CANNOT_SETTLE':
        throw new BadRequestException(
          'Погасить долг или вернуть переплату можно после завершения визита',
        );
    }
  }

  async generatePreviewCode(): Promise<string> {
    const MAX_ATTEMPTS = 10;

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const code = Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, '0');

      const redisKey = `visit_code_lock:${code}`;
      const isLocked = await this.redis.get(redisKey);

      if (isLocked) continue;

      const isUsed = await this.prisma.visit.findUnique({
        where: { visitCode: code },
        select: { id: true },
      });

      if (isUsed) continue;
      const success = await this.redis.set(
        redisKey,
        'reserved',
        'EX',
        15 * 60,
        'NX',
      );

      if (success) return code;
    }

    throw new InternalServerErrorException(
      'Не удалось сгенерировать уникальный код. Попробуйте позже.',
    );
  }

  async createVisit(
    data: CreateVisitRequestDto,
    sendNotification: boolean,
    actor: VisitAuditActor,
  ): Promise<CreateVisitResponseDto> {
    const commandId = randomUUID();
    const fullStartDt = this.parseDateTime(
      data.startDateTime,
      data.issueTimeFrom,
    );
    const fullEndDt = this.parseDateTime(
      data.endDateTime,
      data.returnTimeUntil,
    );

    try {
      Visit.validateCreationStructure({
        startDateTime: fullStartDt,
        endDateTime: fullEndDt,
        orders: data.orders,
      });
    } catch (error) {
      this.rethrowVisitRule(error);
    }

    const redisKey = `visit_code_lock:${data.visitCode}`;
    const isReserved = await this.redis.get(redisKey);
    if (!isReserved) {
      throw new ConflictException(
        'Код визита не найден в резерве или его время истекло',
      );
    }

    try {
      Visit.validateCreationMoney(data.orders);
    } catch (error) {
      this.rethrowVisitRule(error);
    }

    try {
      const result = await this.withSerializableTransaction(async (tx) => {
        const client = await tx.client.findFirst({
          where: { id: data.clientId, deletedAt: null },
        });
        if (!client)
          throw new NotFoundException(`Клиент с ID ${data.clientId} не найден`);
        if (client.isBlacklisted) {
          const reason = client.blacklistReason
            ? ` Причина: ${client.blacklistReason}.`
            : '';
          throw new BadRequestException(
            `Клиент «${client.name}» в чёрном списке — бронирование невозможно.${reason} Чтобы забронировать, снимите запрет на странице «Клиенты».`,
          );
        }
        const [children, costumes] = await Promise.all([
          tx.child.findMany({
            where: {
              id: { in: data.orders.map((order) => order.childId) },
              deletedAt: null,
            },
            select: { id: true, clientId: true },
          }),
          tx.costume.findMany({
            where: {
              id: { in: data.orders.map((order) => order.costumeId) },
              deletedAt: null,
            },
            select: { id: true },
          }),
        ]);
        const childrenById = new Map(
          children.map((child) => [child.id, child]),
        );
        const costumeIds = new Set(costumes.map((costume) => costume.id));
        const invalidOrders = data.orders.flatMap((order, index) => {
          const errors: string[] = [];
          const child = childrenById.get(order.childId);
          if (!child) {
            errors.push(
              `заказ ${index + 1}: ребёнок ID ${order.childId} не найден или удалён`,
            );
          } else if (child.clientId !== data.clientId) {
            errors.push(
              `заказ ${index + 1}: ребёнок ID ${order.childId} не принадлежит клиенту`,
            );
          }
          if (!costumeIds.has(order.costumeId)) {
            errors.push(
              `заказ ${index + 1}: костюм ID ${order.costumeId} не найден или удалён`,
            );
          }
          return errors;
        });
        if (invalidOrders.length > 0) {
          throw new BadRequestException(
            `Бронирование невозможно: ${invalidOrders.join('; ')}`,
          );
        }

        const busyCostumes = await this.isSuitAvailability(
          data.orders.map((order) => order.costumeId),
          fullStartDt,
          fullEndDt,
          tx,
        );
        if (busyCostumes.length > 0) {
          const names = busyCostumes
            .map((costume) => `"${costume.name}"`)
            .join(', ');
          throw new BadRequestException(
            `Бронирование невозможно. Костюмы: ${names} уже заняты в этот промежуток времени.`,
          );
        }
        const traceId =
          (this.logger.logger as unknown as PinoLoggerWithId).id ??
          crypto.randomUUID();

        const visit = await tx.visit.create({
          data: {
            visitCode: data.visitCode,
            clientId: data.clientId,
            startDateTime: fullStartDt,
            endDateTime: fullEndDt,
            issueTimeFrom: data.issueTimeFrom,
            issueTimeTo: data.issueTimeTo,
            returnTimeUntil: data.returnTimeUntil,
            notes: data.notes,
            orders: {
              create: data.orders.map((o) => ({
                ...o,
                clientId: data.clientId,
                startDateTime: fullStartDt,
                endDateTime: fullEndDt,
              })),
            },
            ...(sendNotification && {
              notifications: {
                create: {
                  type: 'booking_confirmation',
                  status: 'pending',
                  traceId: traceId,
                },
              },
            }),
          },
          include: {
            client: true,
            notifications: true,
            orders: {
              include: {
                child: true,
                costume: true,
              },
            },
          },
        });

        await this.recordAuditEvents(tx, actor, commandId, [
          {
            action: 'visit.created',
            entityType: 'visit',
            entityId: visit.id,
            visitId: visit.id,
            payload: {
              kind: 'visit.created',
              visitCode: visit.visitCode,
              clientId: visit.client.id,
              clientName: visit.client.name,
              startDateTime: visit.startDateTime.toISOString().split('T')[0],
              endDateTime: visit.endDateTime.toISOString().split('T')[0],
              orders: visit.orders.map((order) => ({
                orderId: order.id,
                childName: order.child.name,
                costumeName: order.costume.name,
                inventoryCode: order.costume.inventoryCode,
                rentPrice: order.rentPrice,
                prepaymentAmount: order.prepaymentAmount,
              })),
            },
          },
        ]);

        return visit;
      });
      await this.redis.del(redisKey);

      if (sendNotification && result.notifications.length > 0) {
        const pendingNotification = result.notifications[0];

        try {
          await this.notificationQueue.add(
            'send-whatsapp',
            {
              notificationId: pendingNotification.id,
              traceId: pendingNotification.traceId,
            },
            {
              jobId: `notification-${pendingNotification.id}`,
            },
          );
        } catch (queueError) {
          this.logger.logger.error(
            {
              err: queueError,
              visitId: result.id,
              notificationId: pendingNotification.id,
            },
            'Failed to add WhatsApp job to queue. Visit was created, but notification requires manual resend.',
          );
        }
      }

      const preparedData = {
        id: result.id,
        visitCode: result.visitCode,
        status: result.status,
        client: {
          id: result.client.id,
          fullname: result.client.name,
          phone: result.client.phone,
        },
        visitDate: {
          startDateTime: result.startDateTime.toISOString().split('T')[0],
          endDateTime: result.endDateTime.toISOString().split('T')[0],
          issueTimeFrom: result.issueTimeFrom,
          issueTimeTo: result.issueTimeTo,
          returnTimeUntil: result.returnTimeUntil,
        },
        notifications: result.notifications.map((n) => ({
          id: n.id,
          type: n.type,
          status: n.status,
          createdAt: n.createdAt.toISOString(),
        })),
        orders: result.orders.map((o) => ({
          orderId: o.id,
          childName: o.child.name,
          costumeName: o.costume.name,
          inventoryCode: o.costume.inventoryCode,
          rentPrice: o.rentPrice,
          prepaymentAmount: o.prepaymentAmount,
          tagStatus: o.tagStatus,
        })),
      };

      return CreateVisitResponseSchema.parse(preparedData);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2003') {
          throw new BadRequestException(
            'Ошибка в данных: указан несуществующий ребенок или костюм',
          );
        }
      }
      throw error;
    }
  }

  async quickIssueVisit(
    data: QuickIssueVisitRequestDto,
    actor: VisitAuditActor,
  ): Promise<QuickIssueVisitResponseDto> {
    if (actor.source !== 'user') {
      throw new BadRequestException(
        'Быстрая выдача требует сотрудника из токена',
      );
    }
    if (data.issueTimeFrom !== data.issueTimeTo) {
      throw new BadRequestException(
        'Время быстрой выдачи должно совпадать с фактическим временем начала',
      );
    }
    const fullStartDt = this.parseDateTime(
      data.startDateTime,
      data.issueTimeFrom,
    );
    const fullEndDt = this.parseDateTime(
      data.endDateTime,
      data.returnTimeUntil,
    );
    if (
      Number.isNaN(fullStartDt.getTime()) ||
      Number.isNaN(fullEndDt.getTime()) ||
      fullStartDt.toISOString().slice(0, 10) !== data.startDateTime ||
      fullEndDt.toISOString().slice(0, 10) !== data.endDateTime
    ) {
      throw new BadRequestException('Указана некорректная дата визита');
    }
    try {
      Visit.validateCreationStructure({
        startDateTime: fullStartDt,
        endDateTime: fullEndDt,
        orders: data.orders.map((order) => ({
          ...order,
          prepaymentAmount: 0,
        })),
      });
      Visit.validateCreationMoney(
        data.orders.map((order) => ({ ...order, prepaymentAmount: 0 })),
      );
      Visit.validateIssuePayment(data.additionalPayment);
    } catch (error) {
      this.rethrowVisitRule(error);
    }
    if (
      !Number.isSafeInteger(data.deposit.amount ?? 0) ||
      (data.deposit.amount ?? 0) < 0
    ) {
      throw new BadRequestException('Сумма залога должна быть неотрицательной');
    }

    const commandPath = 'POST /visits/quick-issue';
    const redisKey = `visit_code_lock:${data.visitCode}`;
    const result = await executeWithCommandReceipt(
      this.prisma,
      {
        commandId: data.commandId,
        actorUserId: actor.userId,
        commandPath,
        requestHash: hashCommandRequest(data),
      },
      async (tx) => {
        const isReserved = await this.redis.get(redisKey);
        if (!isReserved) {
          throw new ConflictException({
            statusCode: 409,
            message: 'Срок действия кода визита истёк. Получите новый код',
            code: 'QUICK_ISSUE_CODE_EXPIRED',
          });
        }
        const existingVisit = await tx.visit.findUnique({
          where: { visitCode: data.visitCode },
          select: { id: true },
        });
        if (existingVisit) {
          throw new ConflictException({
            statusCode: 409,
            message: 'Этот код визита уже использован',
            code: 'VISIT_CODE_ALREADY_USED',
          });
        }

        const client = await tx.client.findFirst({
          where: { id: data.clientId, deletedAt: null },
        });
        if (!client) {
          throw new NotFoundException(`Клиент с ID ${data.clientId} не найден`);
        }
        if (client.isBlacklisted) {
          const reason = client.blacklistReason
            ? ` Причина: ${client.blacklistReason}.`
            : '';
          throw new BadRequestException(
            `Клиент «${client.name}» в чёрном списке — выдача невозможна.${reason}`,
          );
        }

        const [children, costumes] = await Promise.all([
          tx.child.findMany({
            where: {
              id: { in: data.orders.map((order) => order.childId) },
              deletedAt: null,
            },
            select: { id: true, clientId: true },
          }),
          tx.costume.findMany({
            where: {
              id: { in: data.orders.map((order) => order.costumeId) },
              deletedAt: null,
            },
            select: { id: true, parts: true },
          }),
        ]);
        const childrenById = new Map(
          children.map((child) => [child.id, child]),
        );
        const costumeIds = new Set(costumes.map((costume) => costume.id));
        const partsByCostume = new Map(
          costumes.map((costume) => [
            costume.id,
            parseCostumeParts(costume.parts),
          ]),
        );
        const invalidOrders = data.orders.flatMap((order, index) => {
          const errors: string[] = [];
          const child = childrenById.get(order.childId);
          if (!child) {
            errors.push(`заказ ${index + 1}: ребёнок не найден или удалён`);
          } else if (child.clientId !== data.clientId) {
            errors.push(`заказ ${index + 1}: ребёнок не принадлежит клиенту`);
          }
          if (!costumeIds.has(order.costumeId)) {
            errors.push(`заказ ${index + 1}: костюм не найден или удалён`);
          }
          return errors;
        });
        if (invalidOrders.length > 0) {
          throw new BadRequestException(
            `Быстрая выдача невозможна: ${invalidOrders.join('; ')}`,
          );
        }

        const busyCostumes = await this.isSuitAvailability(
          data.orders.map((order) => order.costumeId),
          fullStartDt,
          fullEndDt,
          tx,
        );
        if (busyCostumes.length > 0) {
          throw new BadRequestException(
            `Костюмы ${busyCostumes.map((costume) => `«${costume.name}»`).join(', ')} уже заняты в этот промежуток времени`,
          );
        }

        let remainingPayment = data.additionalPayment;
        const visit = await tx.visit.create({
          data: {
            visitCode: data.visitCode,
            clientId: data.clientId,
            startDateTime: fullStartDt,
            endDateTime: fullEndDt,
            issueTimeFrom: data.issueTimeFrom,
            issueTimeTo: data.issueTimeTo,
            returnTimeUntil: data.returnTimeUntil,
            status: 'issued',
            notes: data.notes,
            orders: {
              create: data.orders.map((order) => {
                const finalPayment = Math.min(
                  remainingPayment,
                  order.rentPrice,
                );
                remainingPayment -= finalPayment;
                return {
                  childId: order.childId,
                  costumeId: order.costumeId,
                  rentPrice: order.rentPrice,
                  notes: order.notes,
                  clientId: data.clientId,
                  startDateTime: fullStartDt,
                  endDateTime: fullEndDt,
                  prepaymentAmount: 0,
                  finalPayment,
                  tagStatus: 'not_required',
                  status: 'issued',
                  issuedParts: partsByCostume.get(order.costumeId) ?? [],
                };
              }),
            },
            deposits: {
              create: {
                type: data.deposit.type,
                amount:
                  data.deposit.type === 'cash' ? (data.deposit.amount ?? 0) : 0,
                returned: false,
              },
            },
          },
          include: {
            client: { select: { id: true, name: true } },
            orders: {
              include: {
                child: { select: { name: true } },
                costume: {
                  select: { name: true, inventoryCode: true },
                },
              },
            },
          },
        });
        if (data.additionalPayment > 0) {
          await tx.visitMoneyOperation.create({
            data: {
              visitId: visit.id,
              kind: 'issue_payment',
              amount: data.additionalPayment,
            },
          });
        }

        const orderSnapshots = visit.orders.map((order) => ({
          orderId: order.id,
          childName: order.child.name,
          costumeName: order.costume.name,
          inventoryCode: order.costume.inventoryCode,
          rentPrice: order.rentPrice,
          prepaymentAmount: 0,
        }));
        const auditEvents: VisitAuditEventInput[] = [
          {
            action: 'visit.created',
            entityType: 'visit',
            entityId: visit.id,
            visitId: visit.id,
            payload: {
              kind: 'visit.created',
              visitCode: visit.visitCode,
              clientId: visit.client.id,
              clientName: visit.client.name,
              startDateTime: data.startDateTime,
              endDateTime: data.endDateTime,
              orders: orderSnapshots,
            },
          },
          {
            action: 'visit.issued',
            entityType: 'visit',
            entityId: visit.id,
            visitId: visit.id,
            payload: {
              kind: 'visit.issued',
              visitCode: visit.visitCode,
              additionalPayment: data.additionalPayment,
              depositType: data.deposit.type,
              depositAmount:
                data.deposit.type === 'cash' ? (data.deposit.amount ?? 0) : 0,
              orders: orderSnapshots,
            },
          },
        ];
        if (data.additionalPayment > 0) {
          auditEvents.push({
            action: 'money.received',
            entityType: 'visit',
            entityId: visit.id,
            visitId: visit.id,
            payload: {
              kind: 'money.received',
              moneyKind: 'issue_payment',
              amount: data.additionalPayment,
            },
          });
        }
        await this.recordAuditEvents(tx, actor, data.commandId, auditEvents);

        const balance = calculateVisitBalance({
          orders: visit.orders.map((order) => ({
            rentPrice: order.rentPrice,
            prepaymentAmount: 0,
          })),
          operations:
            data.additionalPayment > 0
              ? [{ kind: 'issue_payment', amount: data.additionalPayment }]
              : [],
        });
        return QuickIssueVisitResponseSchema.parse({
          visitId: visit.id,
          visitCode: visit.visitCode,
          status: visit.status,
          version: visit.version,
          balance,
        });
      },
      (value) => QuickIssueVisitResponseSchema.parse(value),
    );

    await this.redis.del(redisKey);
    return result;
  }

  async updateReservedVisit(
    visitId: number,
    data: UpdateReservedVisitRequestDto,
    actor: VisitAuditActor,
  ): Promise<UpdateReservedVisitResponseDto> {
    if (actor.source !== 'user') {
      throw new BadRequestException(
        'Изменение визита требует сотрудника из токена',
      );
    }
    const startDateTime = this.parseDateTime(
      data.startDateTime,
      data.issueTimeFrom,
    );
    const endDateTime = this.parseDateTime(
      data.endDateTime,
      data.returnTimeUntil,
    );
    if (
      Number.isNaN(startDateTime.getTime()) ||
      Number.isNaN(endDateTime.getTime()) ||
      startDateTime.toISOString().slice(0, 10) !== data.startDateTime ||
      endDateTime.toISOString().slice(0, 10) !== data.endDateTime
    ) {
      throw new BadRequestException('Указана некорректная дата визита');
    }
    if (data.issueTimeFrom > data.issueTimeTo) {
      throw new BadRequestException(
        'Начало окна выдачи не может быть позже его окончания',
      );
    }
    try {
      Visit.validateCreationStructure({
        startDateTime,
        endDateTime,
        orders: data.orders.map((order) => ({
          ...order,
          prepaymentAmount: 0,
        })),
      });
    } catch (error) {
      this.rethrowVisitRule(error);
    }
    const orderIds = data.orders.flatMap((order) =>
      order.orderId === undefined ? [] : [order.orderId],
    );
    if (new Set(orderIds).size !== orderIds.length) {
      throw new BadRequestException('Один заказ указан в визите несколько раз');
    }
    const costumeIds = data.orders.map((order) => order.costumeId);
    if (new Set(costumeIds).size !== costumeIds.length) {
      throw new BadRequestException(
        'Один костюм нельзя добавить в визит дважды',
      );
    }

    return executeWithCommandReceipt(
      this.prisma,
      {
        commandId: data.commandId,
        actorUserId: actor.userId,
        commandPath: `PATCH /visits/${visitId}`,
        requestHash: hashCommandRequest({ visitId, ...data }),
      },
      async (tx) => {
        const visit = await tx.visit.findFirst({
          where: { id: visitId, deletedAt: null },
          include: {
            client: {
              select: {
                id: true,
                name: true,
                isBlacklisted: true,
                deletedAt: true,
              },
            },
            orders: {
              where: { deletedAt: null },
              include: {
                child: { select: { name: true } },
                costume: { select: { name: true, inventoryCode: true } },
              },
            },
          },
        });
        if (!visit)
          throw new NotFoundException(`Визит с ID ${visitId} не найден`);
        if (visit.version !== data.expectedVersion) {
          throw this.visitVersionConflict();
        }
        if (visit.status !== 'reserved') {
          throw new BadRequestException(
            'Редактировать можно только визит со статусом «забронирован»',
          );
        }
        if (visit.orders.some((order) => order.status !== 'reserved')) {
          throw new BadRequestException(
            'Редактировать можно только невыданные заказы визита',
          );
        }
        if (visit.client.deletedAt !== null) {
          throw new NotFoundException(
            `Клиент с ID ${visit.clientId} не найден`,
          );
        }
        if (visit.client.isBlacklisted) {
          throw new BadRequestException(
            'Клиент в чёрном списке — редактирование брони невозможно',
          );
        }

        const currentOrders = new Map(
          visit.orders.map((order) => [order.id, order]),
        );
        const submittedIds = new Set(orderIds);
        for (const orderId of orderIds) {
          if (!currentOrders.has(orderId)) {
            throw new BadRequestException(
              `Заказ с ID ${orderId} не принадлежит визиту или удалён`,
            );
          }
        }
        const removedOrders = visit.orders.filter(
          (order) => !submittedIds.has(order.id),
        );
        const paidRemoval = removedOrders.find(
          (order) => order.prepaymentAmount > 0,
        );
        if (paidRemoval) {
          throw new BadRequestException(
            `Заказ с предоплатой ${paidRemoval.prepaymentAmount} ₸ нельзя удалить`,
          );
        }

        const [children, costumes] = await Promise.all([
          tx.child.findMany({
            where: {
              id: {
                in: [...new Set(data.orders.map((order) => order.childId))],
              },
              clientId: visit.clientId,
              deletedAt: null,
            },
            select: { id: true, name: true },
          }),
          tx.costume.findMany({
            where: { id: { in: [...new Set(costumeIds)] }, deletedAt: null },
            select: { id: true, name: true, inventoryCode: true },
          }),
        ]);
        const childIds = new Set(children.map((child) => child.id));
        const activeCostumeIds = new Set(costumes.map((costume) => costume.id));
        const invalidOrder = data.orders.find(
          (order) =>
            !childIds.has(order.childId) ||
            !activeCostumeIds.has(order.costumeId),
        );
        if (invalidOrder) {
          throw new BadRequestException(
            `Ребёнок или костюм в заказе не найден, удалён или не принадлежит клиенту`,
          );
        }

        for (const input of data.orders) {
          if (input.orderId === undefined) {
            if (input.rentPrice < (input.prepaymentAmount ?? 0)) {
              throw new BadRequestException(
                'Предоплата нового заказа не может превышать стоимость аренды',
              );
            }
            continue;
          }
          const current = currentOrders.get(input.orderId);
          if (!current) continue;
          if (
            input.prepaymentAmount !== undefined &&
            input.prepaymentAmount !== current.prepaymentAmount
          ) {
            throw new BadRequestException(
              'Предоплату сохранённого заказа нельзя изменить в редакторе',
            );
          }
          if (input.rentPrice < current.prepaymentAmount) {
            throw new BadRequestException(
              `Цена аренды не может быть ниже предоплаты ${current.prepaymentAmount} ₸`,
            );
          }
        }

        const busyCostumes = await this.isSuitAvailability(
          costumeIds,
          startDateTime,
          endDateTime,
          tx,
          visitId,
        );
        if (busyCostumes.length > 0) {
          throw new BadRequestException(
            `Костюмы ${busyCostumes.map((costume) => `«${costume.name}»`).join(', ')} уже заняты в этот промежуток времени`,
          );
        }

        const normalizedVisitNotes =
          data.notes === undefined ? visit.notes : data.notes || null;
        const changedFields: Extract<
          VisitHistoryPayloadDto,
          { kind: 'visit.updated' }
        >['changedFields'] = {};
        const changed = (left: unknown, right: unknown) => left !== right;
        const datesChanged =
          changed(
            visit.startDateTime.toISOString().slice(0, 10),
            data.startDateTime,
          ) ||
          changed(
            visit.endDateTime.toISOString().slice(0, 10),
            data.endDateTime,
          );
        const windowChanged =
          datesChanged ||
          changed(visit.issueTimeFrom, data.issueTimeFrom) ||
          changed(visit.issueTimeTo, data.issueTimeTo) ||
          changed(visit.returnTimeUntil, data.returnTimeUntil);
        if (
          changed(
            visit.startDateTime.toISOString().slice(0, 10),
            data.startDateTime,
          )
        )
          changedFields.startDateTime = {
            before: visit.startDateTime.toISOString().slice(0, 10),
            after: data.startDateTime,
          };
        if (changed(visit.issueTimeFrom, data.issueTimeFrom))
          changedFields.issueTimeFrom = {
            before: visit.issueTimeFrom,
            after: data.issueTimeFrom,
          };
        if (changed(visit.issueTimeTo, data.issueTimeTo))
          changedFields.issueTimeTo = {
            before: visit.issueTimeTo,
            after: data.issueTimeTo,
          };
        if (
          changed(
            visit.endDateTime.toISOString().slice(0, 10),
            data.endDateTime,
          )
        )
          changedFields.endDateTime = {
            before: visit.endDateTime.toISOString().slice(0, 10),
            after: data.endDateTime,
          };
        if (changed(visit.returnTimeUntil, data.returnTimeUntil))
          changedFields.returnTimeUntil = {
            before: visit.returnTimeUntil,
            after: data.returnTimeUntil,
          };
        if (changed(visit.notes, normalizedVisitNotes))
          changedFields.notes = {
            before: visit.notes,
            after: normalizedVisitNotes,
          };

        const snapshot = (order: (typeof visit.orders)[number]) => ({
          orderId: order.id,
          childId: order.childId,
          childName: order.child.name,
          costumeId: order.costumeId,
          costumeName: order.costume.name,
          inventoryCode: order.costume.inventoryCode,
          rentPrice: order.rentPrice,
          prepaymentAmount: order.prepaymentAmount,
          tagStatus: order.tagStatus,
          notes: order.notes,
        });
        const orderChanges: Extract<
          VisitHistoryPayloadDto,
          { kind: 'visit.updated' }
        >['orderChanges'] = [];
        const tagInvalidations: VisitAuditEventInput[] = [];
        for (const input of data.orders) {
          const current =
            input.orderId === undefined
              ? undefined
              : currentOrders.get(input.orderId);
          if (!current) {
            const created = await tx.order.create({
              data: {
                visitId,
                clientId: visit.clientId,
                childId: input.childId,
                costumeId: input.costumeId,
                rentPrice: input.rentPrice,
                prepaymentAmount: input.prepaymentAmount ?? 0,
                startDateTime,
                endDateTime,
                notes: input.notes || null,
                status: 'reserved',
                tagStatus: 'not_written',
              },
              include: {
                child: { select: { name: true } },
                costume: { select: { name: true, inventoryCode: true } },
              },
            });
            orderChanges.push({
              change: 'added',
              orderId: created.id,
              after: {
                orderId: created.id,
                childId: created.childId,
                childName: created.child.name,
                costumeId: created.costumeId,
                costumeName: created.costume.name,
                inventoryCode: created.costume.inventoryCode,
                rentPrice: created.rentPrice,
                prepaymentAmount: created.prepaymentAmount,
                tagStatus: created.tagStatus,
                notes: created.notes,
              },
            });
            continue;
          }
          const updatedNotes =
            input.notes === undefined ? current.notes : input.notes || null;
          const periodChanged =
            current.startDateTime.getTime() !== startDateTime.getTime() ||
            current.endDateTime.getTime() !== endDateTime.getTime();
          const childChanged = current.childId !== input.childId;
          const costumeChanged = current.costumeId !== input.costumeId;
          const orderChanged =
            childChanged ||
            costumeChanged ||
            current.rentPrice !== input.rentPrice ||
            current.notes !== updatedNotes ||
            periodChanged ||
            (current.tagStatus === 'written' && windowChanged);
          const invalidateTag =
            current.tagStatus === 'written' &&
            (windowChanged || childChanged || costumeChanged);
          if (orderChanged) {
            await tx.order.update({
              where: { id: current.id },
              data: {
                childId: input.childId,
                costumeId: input.costumeId,
                rentPrice: input.rentPrice,
                notes: updatedNotes,
                startDateTime,
                endDateTime,
                ...(invalidateTag ? { tagStatus: 'not_written' as const } : {}),
              },
            });
            orderChanges.push({
              change: 'updated',
              orderId: current.id,
              before: snapshot(current),
              after: {
                orderId: current.id,
                childId: input.childId,
                childName:
                  children.find((child) => child.id === input.childId)?.name ??
                  current.child.name,
                costumeId: input.costumeId,
                costumeName:
                  costumes.find((costume) => costume.id === input.costumeId)
                    ?.name ?? current.costume.name,
                inventoryCode:
                  costumes.find((costume) => costume.id === input.costumeId)
                    ?.inventoryCode ?? current.costume.inventoryCode,
                rentPrice: input.rentPrice,
                prepaymentAmount: current.prepaymentAmount,
                tagStatus: invalidateTag ? 'not_written' : current.tagStatus,
                notes: updatedNotes,
              },
            });
            if (invalidateTag) {
              const reason = datesChanged
                ? 'date_changed'
                : childChanged
                  ? 'child_changed'
                  : costumeChanged
                    ? 'costume_changed'
                    : 'window_changed';
              const childName =
                children.find((child) => child.id === input.childId)?.name ??
                current.child.name;
              const costume = costumes.find(
                (item) => item.id === input.costumeId,
              );
              tagInvalidations.push({
                action: 'tag.invalidated',
                entityType: 'order',
                entityId: current.id,
                visitId,
                orderId: current.id,
                payload: {
                  kind: 'tag.invalidated',
                  orderId: current.id,
                  childName,
                  costumeName: costume?.name ?? current.costume.name,
                  inventoryCode:
                    costume?.inventoryCode ?? current.costume.inventoryCode,
                  reason,
                  previousTagStatus: 'written',
                  tagStatus: 'not_written',
                },
              });
            }
          }
        }
        for (const order of removedOrders) {
          await tx.order.update({
            where: { id: order.id },
            data: { deletedAt: new Date() },
          });
          orderChanges.push({
            change: 'removed',
            orderId: order.id,
            before: snapshot(order),
          });
        }

        const visitChanged =
          Object.keys(changedFields).length > 0 || orderChanges.length > 0;
        if (visitChanged) {
          const updated = await tx.visit.updateMany({
            where: {
              id: visitId,
              deletedAt: null,
              status: 'reserved',
              version: data.expectedVersion,
            },
            data: {
              startDateTime,
              endDateTime,
              issueTimeFrom: data.issueTimeFrom,
              issueTimeTo: data.issueTimeTo,
              returnTimeUntil: data.returnTimeUntil,
              notes: normalizedVisitNotes,
              version: { increment: 1 },
            },
          });
          if (updated.count !== 1) throw this.visitVersionConflict();
          await this.recordAuditEvents(tx, actor, data.commandId, [
            {
              action: 'visit.updated',
              entityType: 'visit',
              entityId: visitId,
              visitId,
              payload: {
                kind: 'visit.updated',
                changedFields,
                orderChanges,
              },
            },
            ...tagInvalidations,
          ]);
        }
        return readVisitDetail(tx, visitId, this.photos);
      },
      (value) => UpdateReservedVisitResponseSchema.parse(value),
    );
  }

  private visitVersionConflict(): ConflictException {
    return new ConflictException({
      statusCode: 409,
      code: 'VISIT_VERSION_CONFLICT',
      message:
        'Визит изменён другим сотрудником. Обновите данные и повторите действие',
    });
  }

  async addAndIssueVisitOrders(
    visitId: number,
    data: AddAndIssueVisitRequestDto,
    actor: VisitAuditActor,
  ): Promise<AddAndIssueVisitResponseDto> {
    if (actor.source !== 'user') {
      throw new BadRequestException(
        'Добавление заказов требует сотрудника из токена',
      );
    }

    return executeWithCommandReceipt(
      this.prisma,
      {
        commandId: data.commandId,
        actorUserId: actor.userId,
        commandPath: `POST /visits/${visitId}/add-and-issue`,
        requestHash: hashCommandRequest({ visitId, ...data }),
      },
      async (tx) => {
        const visit = await tx.visit.findFirst({
          where: { id: visitId, deletedAt: null },
          include: {
            client: {
              select: {
                id: true,
                name: true,
                isBlacklisted: true,
                deletedAt: true,
              },
            },
            orders: {
              where: { deletedAt: null },
              include: {
                child: { select: { name: true } },
                costume: { select: { name: true, inventoryCode: true } },
              },
            },
          },
        });
        if (!visit) {
          throw new NotFoundException(`Визит с ID ${visitId} не найден`);
        }
        if (visit.version !== data.expectedVersion) {
          throw this.visitVersionConflict();
        }
        if (visit.client.deletedAt !== null) {
          throw new NotFoundException(
            `Клиент с ID ${visit.clientId} не найден`,
          );
        }
        if (visit.client.isBlacklisted) {
          throw new BadRequestException(
            'Клиент в чёрном списке — добавить костюм невозможно',
          );
        }

        let decision;
        try {
          decision = this.visitDomain({
            status: visit.status,
            notes: visit.notes,
            orders: visit.orders,
            moneyOperations: [],
          }).addAndIssue(
            data.orders.map(({ costumeId, rentPrice }) => ({
              costumeId,
              rentPrice,
            })),
            data.additionalPayment,
            visit.orders.map((order) => order.costumeId),
          );
        } catch (error) {
          this.rethrowVisitRule(error);
        }

        const childIds = [
          ...new Set(data.orders.map((order) => order.childId)),
        ];
        const costumeIds = data.orders.map((order) => order.costumeId);
        const [children, costumes] = await Promise.all([
          tx.child.findMany({
            where: {
              id: { in: childIds },
              clientId: visit.clientId,
              deletedAt: null,
            },
            select: { id: true, name: true },
          }),
          tx.costume.findMany({
            where: { id: { in: costumeIds }, deletedAt: null },
            select: {
              id: true,
              name: true,
              inventoryCode: true,
              parts: true,
            },
          }),
        ]);
        const childrenById = new Map(
          children.map((child) => [child.id, child]),
        );
        const costumesById = new Map(
          costumes.map((costume) => [costume.id, costume]),
        );
        const invalidIndex = data.orders.findIndex(
          (order) =>
            !childrenById.has(order.childId) ||
            !costumesById.has(order.costumeId),
        );
        if (invalidIndex >= 0) {
          throw new BadRequestException(
            `Ребёнок или костюм в заказе ${invalidIndex + 1} не найден, удалён или не принадлежит клиенту`,
          );
        }

        const busyCostumes = await this.isSuitAvailability(
          costumeIds,
          visit.startDateTime,
          visit.endDateTime,
          tx,
        );
        if (busyCostumes.length > 0) {
          throw new BadRequestException(
            `Костюмы ${busyCostumes.map((costume) => `«${costume.name}»`).join(', ')} заняты в этот период`,
          );
        }

        const paymentsByCostume = new Map(
          decision.addedOrders.map((order) => [
            order.costumeId,
            order.finalPayment,
          ]),
        );
        const createdOrders = [];
        for (const input of data.orders) {
          const created = await tx.order.create({
            data: {
              visitId,
              clientId: visit.clientId,
              childId: input.childId,
              costumeId: input.costumeId,
              rentPrice: input.rentPrice,
              prepaymentAmount: 0,
              finalPayment: paymentsByCostume.get(input.costumeId) ?? 0,
              startDateTime: visit.startDateTime,
              endDateTime: visit.endDateTime,
              notes: input.notes || null,
              status: 'issued',
              tagStatus: 'not_required',
              issuedParts: parseCostumeParts(
                costumesById.get(input.costumeId)?.parts,
              ),
            },
            include: {
              child: { select: { name: true } },
              costume: { select: { name: true, inventoryCode: true } },
            },
          });
          createdOrders.push(created);
        }

        if (data.additionalPayment > 0) {
          await tx.visitMoneyOperation.create({
            data: {
              visitId,
              kind: 'issue_payment',
              amount: data.additionalPayment,
            },
          });
        }

        const update = await tx.visit.updateMany({
          where: {
            id: visitId,
            deletedAt: null,
            status: 'issued',
            version: data.expectedVersion,
          },
          data: { version: { increment: 1 } },
        });
        if (update.count !== 1) {
          throw this.visitVersionConflict();
        }

        const snapshots = createdOrders.map((order) => ({
          orderId: order.id,
          childId: order.childId,
          childName: order.child.name,
          costumeId: order.costumeId,
          costumeName: order.costume.name,
          inventoryCode: order.costume.inventoryCode,
          rentPrice: order.rentPrice,
          prepaymentAmount: 0,
          tagStatus: order.tagStatus,
          notes: order.notes,
        }));
        const events: VisitAuditEventInput[] = [
          {
            action: 'orders.added_and_issued',
            entityType: 'visit',
            entityId: visitId,
            visitId,
            payload: {
              kind: 'orders.added_and_issued',
              visitCode: visit.visitCode,
              orders: snapshots,
            },
          },
        ];
        if (data.additionalPayment > 0) {
          events.push({
            action: 'money.received',
            entityType: 'visit',
            entityId: visitId,
            visitId,
            payload: {
              kind: 'money.received',
              moneyKind: 'issue_payment',
              amount: data.additionalPayment,
            },
          });
        }
        await this.recordAuditEvents(tx, actor, data.commandId, events);

        return readVisitDetail(tx, visitId, this.photos);
      },
      (value) => AddAndIssueVisitResponseSchema.parse(value),
    );
  }

  async isSuitAvailability(
    costumeIds: number[],
    startDateTime: Date,
    endDateTime: Date,
    db: Prisma.TransactionClient = this.prisma,
    excludeVisitId?: number,
  ): Promise<{ id: number; name: string }[]> {
    const conflicts = await db.order.findMany({
      where: {
        costumeId: { in: costumeIds },
        deletedAt: null,
        status: { in: ['reserved', 'issued'] },
        visit: {
          deletedAt: null,
          status: { not: 'cancelled' },
          ...(excludeVisitId === undefined
            ? {}
            : { id: { not: excludeVisitId } }),
        },
        AND: [
          { startDateTime: { lt: endDateTime } },
          { endDateTime: { gt: startDateTime } },
        ],
      },
      select: {
        costume: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    const uniqueConflicts = new Map<number, string>();
    conflicts.forEach((c) => uniqueConflicts.set(c.costume.id, c.costume.name));

    return Array.from(uniqueConflicts).map(([id, name]) => ({ id, name }));
  }

  async findOrdersNotWritten(): Promise<OrdersNotWrittenResponseDto> {
    const orders = await this.prisma.order.findMany({
      where: {
        tagStatus: 'not_written',
        deletedAt: null,
        status: {
          notIn: ['cancelled', 'returned'],
        },
        visit: {
          deletedAt: null,
          status: {
            notIn: ['completed', 'cancelled'],
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        costume: true,
        child: true,
        visit: {
          include: {
            client: true,
          },
        },
      },
    });

    const summaries = await this.photos.summaries(
      orders.map((order) => order.costumeId),
    );
    const items = orders.map((order) => ({
      orderId: order.id,
      inventoryCode: order.costume.inventoryCode,
      costumeName: order.costume.name,
      photoCount: 0,
      ...summaries.get(order.costumeId),
      visitCode: order.visit.visitCode,
      childName: order.child.name,
      clientPhone: order.visit.client.phone,
      startDateTime: order.startDateTime.toISOString().split('T')[0],
      endDateTime: order.endDateTime.toISOString().split('T')[0],
      issueTimeFrom: order.visit.issueTimeFrom,
      issueTimeTo: order.visit.issueTimeTo,
      returnTimeUntil: order.visit.returnTimeUntil,
      rentPrice: order.rentPrice,
      prepaymentAmount: order.prepaymentAmount,
      notes: order.notes || '',
    }));

    return OrdersNotWrittenResponseSchema.parse({
      items,
      message:
        items.length > 0
          ? 'Заказы успешно найдены'
          : 'Нет заказов для обработки',
    });
  }

  async orderMarkTagWritten(
    orderId: number,
    actor: VisitAuditActor,
  ): Promise<void> {
    const commandId = randomUUID();
    await this.withSerializableTransaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, deletedAt: null, visit: { deletedAt: null } },
        include: {
          visit: { select: { id: true, version: true } },
          child: { select: { name: true } },
          costume: { select: { name: true, inventoryCode: true } },
        },
      });
      if (!order) {
        throw new NotFoundException(`Заказ с ID ${orderId} не найден`);
      }
      if (order.tagStatus === 'written') return;

      const changed = await tx.order.updateMany({
        where: { id: orderId, deletedAt: null, tagStatus: 'not_written' },
        data: { tagStatus: 'written' },
      });
      if (changed.count === 0) return;

      await this.updateVisitWithVersion(tx, order.visitId, order.visit.version);

      await this.recordAuditEvents(tx, actor, commandId, [
        {
          action: 'tag.written',
          entityType: 'order',
          entityId: order.id,
          visitId: order.visitId,
          orderId: order.id,
          payload: {
            kind: 'tag.written',
            orderId: order.id,
            childName: order.child.name,
            costumeName: order.costume.name,
            inventoryCode: order.costume.inventoryCode,
          },
        },
      ]);
    });
  }

  async visitIssue(
    data: VisitIssueRequestDto,
    visitId: number,
    actor: VisitAuditActor,
  ): Promise<void> {
    const commandId = randomUUID();
    const { deposit, additionalPayment } = data;
    try {
      Visit.validateIssuePayment(additionalPayment);
    } catch (error) {
      this.rethrowVisitRule(error);
    }

    await this.withSerializableTransaction(async (tx) => {
      const visit = await tx.visit.findFirst({
        where: { id: visitId, deletedAt: null },
        include: {
          orders: {
            where: { deletedAt: null },
            include: {
              child: { select: { name: true } },
              costume: {
                select: { name: true, inventoryCode: true, parts: true },
              },
            },
          },
        },
      });

      if (!visit) {
        throw new NotFoundException(`Визит с ID ${visitId} не найден`);
      }

      let decision;
      try {
        decision = this.visitDomain({
          status: visit.status,
          notes: visit.notes,
          orders: visit.orders,
          moneyOperations: [],
        }).issue(additionalPayment, data.notes);
      } catch (error) {
        this.rethrowVisitRule(error);
      }

      const ordersById = new Map(
        visit.orders.map((order) => [order.id, order]),
      );
      for (const orderPayment of decision.orderPayments) {
        const order = ordersById.get(orderPayment.orderId);
        await tx.order.update({
          where: { id: orderPayment.orderId, deletedAt: null },
          data: {
            status: decision.orderStatus,
            finalPayment: orderPayment.finalPayment,
            // Снимок состава: возврат сверяем с выданным, даже если состав костюма потом изменят
            issuedParts: parseCostumeParts(order?.costume.parts),
          },
        });
      }

      if (decision.issuePayment !== null) {
        await tx.visitMoneyOperation.create({
          data: {
            visitId,
            kind: 'issue_payment',
            amount: decision.issuePayment,
          },
        });
      }

      await this.updateVisitWithVersion(tx, visitId, visit.version, {
        status: decision.visitStatus,
        notes: decision.notes,
      });

      try {
        await tx.deposit.create({
          data: {
            visitId: visitId,
            type: deposit.type,
            amount: deposit.type === 'cash' ? (deposit.amount ?? 0) : 0,
            returned: false,
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new ConflictException(
            `Для визита №${visitId} депозит уже был оформлен ранее`,
          );
        }
        throw error;
      }

      const orderSnapshots = visit.orders.map((order) => ({
        orderId: order.id,
        childName: order.child.name,
        costumeName: order.costume.name,
        inventoryCode: order.costume.inventoryCode,
        rentPrice: order.rentPrice,
        prepaymentAmount: order.prepaymentAmount,
      }));
      const auditEvents: VisitAuditEventInput[] = [
        {
          action: 'visit.issued',
          entityType: 'visit',
          entityId: visit.id,
          visitId: visit.id,
          payload: {
            kind: 'visit.issued',
            visitCode: visit.visitCode,
            additionalPayment,
            depositType: deposit.type,
            depositAmount: deposit.type === 'cash' ? (deposit.amount ?? 0) : 0,
            orders: orderSnapshots,
          },
        },
      ];
      if (decision.issuePayment !== null) {
        auditEvents.push({
          action: 'money.received',
          entityType: 'visit',
          entityId: visit.id,
          visitId: visit.id,
          payload: {
            kind: 'money.received',
            moneyKind: 'issue_payment',
            amount: decision.issuePayment,
          },
        });
      }
      await this.recordAuditEvents(tx, actor, commandId, auditEvents);
    });
  }

  async visitUnissue(visitId: number, actor: VisitAuditActor): Promise<void> {
    const commandId = randomUUID();
    await this.withSerializableTransaction(async (tx) => {
      const visit = await tx.visit.findFirst({
        where: { id: visitId, deletedAt: null },
        include: {
          orders: {
            where: { deletedAt: null },
            include: {
              child: { select: { name: true } },
              costume: { select: { name: true, inventoryCode: true } },
            },
          },
          deposits: { where: { deletedAt: null }, take: 1 },
          moneyOperations: {
            where: { kind: 'issue_payment', voidedAt: null },
          },
        },
      });

      if (!visit) {
        throw new NotFoundException(`Визит с ID ${visitId} не найден`);
      }

      let decision;
      try {
        decision = this.visitDomain({
          status: visit.status,
          notes: visit.notes,
          orders: [],
          moneyOperations: [],
        }).unissue();
      } catch (error) {
        this.rethrowVisitRule(error);
      }

      await tx.order.updateMany({
        where: { visitId: visitId, deletedAt: null },
        data: {
          status: decision.orderStatus,
          finalPayment: null,
        },
      });
      await tx.order.updateMany({
        where: {
          visitId,
          deletedAt: null,
          tagStatus: 'not_required',
        },
        data: { tagStatus: 'not_written' },
      });

      await this.updateVisitWithVersion(tx, visitId, visit.version, {
        status: decision.visitStatus,
      });

      await tx.deposit.updateMany({
        where: { visitId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      await tx.visitMoneyOperation.updateMany({
        where: { visitId, kind: 'issue_payment', voidedAt: null },
        data: { voidedAt: new Date() },
      });

      const deposit = visit.deposits[0];
      await this.recordAuditEvents(tx, actor, commandId, [
        {
          action: 'visit.unissued',
          entityType: 'visit',
          entityId: visit.id,
          visitId: visit.id,
          payload: {
            kind: 'visit.unissued',
            visitCode: visit.visitCode,
            voidedPaymentAmount: visit.moneyOperations.reduce(
              (total, operation) => total + operation.amount,
              0,
            ),
            ...(deposit
              ? {
                  depositType: deposit.type,
                  depositAmount: deposit.amount ?? 0,
                }
              : {}),
            orders: visit.orders.map((order) => ({
              orderId: order.id,
              childName: order.child.name,
              costumeName: order.costume.name,
              inventoryCode: order.costume.inventoryCode,
              rentPrice: order.rentPrice,
              prepaymentAmount: order.prepaymentAmount,
            })),
          },
        },
      ]);
    });
  }

  async visitReserved(
    startDate?: string,
    endDate?: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<GetVisitReservedDto> {
    if (startDate && endDate) {
      if (new Date(startDate) > new Date(endDate)) {
        throw new BadRequestException(
          'endDate не может начинаться раньше startDate',
        );
      }
    }

    const where: Prisma.VisitWhereInput = {
      status: 'reserved',
      deletedAt: null,
    };

    if (startDate || endDate) {
      where.startDateTime = {};

      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        where.startDateTime.gte = start;
      }

      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.startDateTime.lte = end;
      }
    }

    const skip = (page - 1) * limit;

    const [visits, totalCount] = await Promise.all([
      this.prisma.visit.findMany({
        where,
        include: {
          client: true,
          orders: {
            where: { deletedAt: null },
            include: {
              child: true,
              costume: true,
            },
          },
        },
        orderBy: {
          startDateTime: 'asc',
        },
        take: limit,
        skip: skip,
      }),
      this.prisma.visit.count({ where }),
    ]);

    const items = visits.map((visit) => {
      const childrenNames = Array.from(
        new Set(visit.orders.map((o) => o.child.name)),
      ).join(', ');

      const costumesNames = visit.orders.map((o) => o.costume.name).join(', ');

      return {
        visitId: visit.id,
        visitCode: visit.visitCode,
        clientName: visit.client.name,
        childrenNames,
        costumesNames,
        clientPhone: visit.client.phone,
      };
    });

    return {
      items,
      total: totalCount,
      page,
      limit,
      hasMore: skip + items.length < totalCount,
    };
  }

  async visitSearch(q: string): Promise<GetVisitSearchDto[]> {
    const search = normalizeSearchQuery(q);
    if (!isSearchQueryReady(search)) return [];

    const wordFilters = buildWordStartFilters(search);
    const identifierFilters = buildIdentifierFilters(search);
    const phoneFilters = buildPhoneFilters(search);

    const searchFilters: Prisma.VisitWhereInput[] = [
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

    const include = {
      client: true,
      orders: {
        where: { deletedAt: null },
        include: {
          child: true,
          costume: true,
        },
      },
    } as const;
    const exactText = buildExactTextFilter(search);
    const exactPhone = buildExactPhoneFilter(search);
    const exactFilters: Prisma.VisitWhereInput[] = [
      { visitCode: exactText },
      { client: { name: exactText } },
      ...(exactPhone ? [{ client: { phone: exactPhone } }] : []),
      {
        orders: {
          some: {
            deletedAt: null,
            OR: [
              { child: { name: exactText } },
              { costume: { name: exactText } },
              { costume: { inventoryCode: exactText } },
            ],
          },
        },
      },
    ];
    const [exactVisits, broadVisits] = await Promise.all([
      this.prisma.visit.findMany({
        where: { status: 'reserved', deletedAt: null, OR: exactFilters },
        include,
        take: 50,
      }),
      this.prisma.visit.findMany({
        where: { status: 'reserved', deletedAt: null, OR: searchFilters },
        include,
        take: 50,
      }),
    ]);
    const visits = mergeUniqueById(exactVisits, broadVisits);

    return sortBySearchScore(visits, (visit) =>
      maxScore([
        scoreIdentifierMatch(visit.visitCode, search),
        scoreTextMatch(visit.client.name, search),
        scorePhoneMatch(visit.client.phone, search),
        ...visit.orders.map((order) =>
          maxScore([
            scoreTextMatch(order.child.name, search),
            scoreTextMatch(order.costume.name, search),
            scoreIdentifierMatch(order.costume.inventoryCode, search),
          ]),
        ),
      ]),
    )
      .slice(0, 50)
      .map((visit) => ({
        visitId: visit.id,
        visitCode: visit.visitCode,
        clientName: visit.client.name,
        clientPhone: visit.client.phone,
        startDateTime: visit.startDateTime.toISOString().split('T')[0],
        childrenNames: Array.from(
          new Set(visit.orders.map((o) => o.child.name)),
        ).join(', '),
        costumesNames: visit.orders.map((o) => o.costume.name).join(', '),
      }));
  }

  async visitForIssue(visitId: number): Promise<GetVisitForIssueDto> {
    const visit = await this.prisma.visit.findFirst({
      where: { id: visitId, deletedAt: null },
      include: {
        client: true,
        orders: {
          where: { deletedAt: null },
          include: {
            child: true,
            costume: true,
          },
        },
      },
    });

    if (!visit) {
      throw new NotFoundException(`Визит с ID ${visitId} не найден`);
    }

    const totalRentPrice = visit.orders.reduce(
      (sum, order) => sum + order.rentPrice,
      0,
    );
    const totalPrepayment = visit.orders.reduce(
      (sum, order) => sum + order.prepaymentAmount,
      0,
    );
    const remainingToPay = totalRentPrice - totalPrepayment;
    const summaries = await this.photos.summaries(
      visit.orders.map((order) => order.costumeId),
    );

    return {
      visitId: visit.id,
      visitCode: visit.visitCode,
      client: {
        name: visit.client.name,
        phone: visit.client.phone,
      },
      startDateTime: visit.startDateTime.toISOString().split('T')[0],
      endDateTime: visit.endDateTime.toISOString().split('T')[0],
      issueTimeFrom: visit.issueTimeFrom,
      issueTimeTo: visit.issueTimeTo,
      returnTimeUntil: visit.returnTimeUntil,
      totalRentPrice,
      totalPrepayment,
      remainingToPay,
      notes: visit.notes || '',
      orders: visit.orders.map((order) => ({
        orderId: order.id,
        childName: order.child.name,
        costumeName: order.costume.name,
        inventoryCode: order.costume.inventoryCode,
        photoCount: 0,
        ...summaries.get(order.costumeId),
        rentPrice: order.rentPrice,
        prepaymentAmount: order.prepaymentAmount,
        tagStatus: order.tagStatus,
        parts: parseCostumeParts(order.costume.parts),
      })),
    };
  }

  async visitsIssuedForReturn(): Promise<IssuedForReturnDto[]> {
    const visits = await this.prisma.visit.findMany({
      where: {
        status: 'issued',
        deletedAt: null,
      },
      include: {
        client: true,
        orders: {
          where: { deletedAt: null },
          include: {
            child: true,
            costume: true,
          },
        },
      },
    });

    return visits.map((visit) => {
      const childrenNames = Array.from(
        new Set(visit.orders.map((o) => o.child.name)),
      ).join(', ');

      const costumeNames = visit.orders.map((o) => o.costume.name).join(', ');

      return {
        visitId: visit.id,
        visitCode: visit.visitCode,
        clientName: visit.client.name,
        childrenNames,
        costumeNames,
        endDateTime: visit.endDateTime.toISOString().split('T')[0],
        clientPhone: visit.client.phone,
        notes: visit.notes || '',
      };
    });
  }

  async visitsReturnSearch(q: string): Promise<GetVisitReturnSearchDto[]> {
    const search = normalizeSearchQuery(q);
    if (!isSearchQueryReady(search)) return [];

    const wordFilters = buildWordStartFilters(search);
    const identifierFilters = buildIdentifierFilters(search);
    const phoneFilters = buildPhoneFilters(search);

    const searchFilters: Prisma.VisitWhereInput[] = [
      ...identifierFilters.map((filter) => ({ visitCode: filter })),
      ...phoneFilters.map((filter) => ({ client: { phone: filter } })),
      ...wordFilters.map((filter) => ({ client: { name: filter } })),
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

    const include = {
      client: true,
      orders: {
        where: { deletedAt: null },
        include: {
          child: true,
          costume: true,
        },
      },
    } as const;
    const exactText = buildExactTextFilter(search);
    const exactPhone = buildExactPhoneFilter(search);
    const exactFilters: Prisma.VisitWhereInput[] = [
      { visitCode: exactText },
      { client: { name: exactText } },
      ...(exactPhone ? [{ client: { phone: exactPhone } }] : []),
      {
        orders: {
          some: {
            deletedAt: null,
            OR: [
              { child: { name: exactText } },
              { costume: { name: exactText } },
              { costume: { inventoryCode: exactText } },
            ],
          },
        },
      },
    ];
    const [exactVisits, broadVisits] = await Promise.all([
      this.prisma.visit.findMany({
        where: { status: 'issued', deletedAt: null, OR: exactFilters },
        include,
        take: 50,
      }),
      this.prisma.visit.findMany({
        where: { status: 'issued', deletedAt: null, OR: searchFilters },
        include,
        take: 50,
      }),
    ]);
    const visits = mergeUniqueById(exactVisits, broadVisits);

    return sortBySearchScore(visits, (visit) =>
      maxScore([
        scoreIdentifierMatch(visit.visitCode, search),
        scoreTextMatch(visit.client.name, search),
        scorePhoneMatch(visit.client.phone, search),
        ...visit.orders.map((order) =>
          maxScore([
            scoreTextMatch(order.child.name, search),
            scoreTextMatch(order.costume.name, search),
            scoreIdentifierMatch(order.costume.inventoryCode, search),
          ]),
        ),
      ]),
    )
      .slice(0, 50)
      .map((visit) => {
        const childrenSet = new Set(visit.orders.map((o) => o.child.name));
        const costumesSet = new Set(visit.orders.map((o) => o.costume.name));
        return {
          visitId: visit.id,
          visitCode: visit.visitCode,
          childrenNames: Array.from(childrenSet).join(', '),
          costumesNames: Array.from(costumesSet).join(', '),
          returnDate: visit.endDateTime.toISOString().split('T')[0],
          clientPhone: visit.client.phone,
          clientName: visit.client.name,
        };
      });
  }

  async visitsForReturn(visitId: number): Promise<GetVisitsForReturnDto> {
    const visit = await this.prisma.visit.findFirst({
      where: {
        id: visitId,
        status: 'issued',
        deletedAt: null,
      },
      include: {
        client: true,
        deposits: { where: { deletedAt: null }, take: 1 },
        moneyOperations: { where: { voidedAt: null } },
        orders: {
          where: { deletedAt: null },
          include: {
            child: true,
            costume: true,
          },
        },
      },
    });

    if (!visit) {
      throw new NotFoundException(
        `Визит №${visitId} не найден или не находится в статусе "Выдан"`,
      );
    }

    const deposit = visit.deposits[0];
    const summaries = await this.photos.summaries(
      visit.orders.map((order) => order.costumeId),
    );

    return {
      visitId: visit.id,
      visitCode: visit.visitCode,
      client: {
        name: visit.client.name,
        phone: visit.client.phone,
      },
      startDateTime: visit.startDateTime.toISOString().split('T')[0],
      endDateTime: visit.endDateTime.toISOString().split('T')[0],
      notes: visit.notes || '',
      orders: visit.orders.map((order) => ({
        orderId: order.id,
        childName: order.child.name,
        costumeName: order.costume.name,
        inventoryCode: order.costume.inventoryCode,
        photoCount: 0,
        ...summaries.get(order.costumeId),
        rentPrice: order.rentPrice,
        prepaymentAmount: order.prepaymentAmount,
        finalPayment: order.finalPayment ?? 0,
        returned: order.status === OrderStatus.returned,
        parts: orderCostumeParts(order),
      })),
      deposit: {
        type: deposit?.type || 'none',
        amount: deposit?.amount || 0,
      },
      balance: calculateVisitBalance({
        orders: visit.orders,
        operations: visit.moneyOperations,
      }),
    };
  }

  async MarkDepositReturned(
    visitId: number,
    notes: string | undefined,
    actor: VisitAuditActor,
  ): Promise<MarkDepositReturnedDto> {
    const commandId = randomUUID();
    await this.withSerializableTransaction(async (tx) => {
      const visit = await tx.visit.findFirst({
        where: { id: visitId, deletedAt: null },
        include: { deposits: { where: { deletedAt: null }, take: 1 } },
      });
      if (!visit) {
        throw new NotFoundException(`Визит с ID ${visitId} не найден`);
      }
      if (visit.status !== VisitStatus.completed) {
        throw new BadRequestException(
          'Вернуть залог можно только после завершения визита',
        );
      }
      const deposit = visit.deposits[0];
      if (!deposit) {
        throw new BadRequestException(
          `Для визита №${visitId} залог не зафиксирован`,
        );
      }
      if (deposit.type === 'none') {
        throw new BadRequestException('У визита нет залога для возврата');
      }
      if (deposit.returned) return;

      await tx.deposit.update({
        where: { id: deposit.id, deletedAt: null },
        data: { returned: true },
      });

      if (notes) {
        const currentNotes = visit.notes ? `${visit.notes}\n` : '';
        await this.updateVisitWithVersion(tx, visitId, visit.version, {
          notes: `${currentNotes}[Возврат залога]: ${notes}`,
        });
      } else {
        await this.updateVisitWithVersion(tx, visitId, visit.version);
      }
      await this.recordAuditEvents(tx, actor, commandId, [
        {
          action: 'deposit.returned',
          entityType: 'visit',
          entityId: visit.id,
          visitId: visit.id,
          payload: {
            kind: 'deposit.returned',
            depositType: deposit.type,
            amount: deposit.amount ?? 0,
          },
        },
      ]);
    });

    return {
      visitId: visitId,
      depositReturned: true,
      message: 'Статус депозита успешно обновлен',
    };
  }

  async visitCompleteReturn(
    visitId: number,
    data: visitCompleteReturnRequestDto,
    actor: VisitAuditActor,
  ): Promise<visitCompleteReturnResponseDto> {
    const commandId = randomUUID();
    const result = await this.withSerializableTransaction(async (tx) => {
      const visit = await tx.visit.findFirst({
        where: { id: visitId, deletedAt: null },
        include: {
          orders: {
            where: { deletedAt: null },
            include: {
              child: { select: { name: true } },
              costume: {
                select: { name: true, inventoryCode: true, parts: true },
              },
            },
          },
          deposits: { where: { deletedAt: null }, take: 1 },
          moneyOperations: { where: { voidedAt: null } },
        },
      });
      if (!visit) {
        throw new NotFoundException(`Визит №${visitId} не найден`);
      }

      let decision;
      try {
        decision = this.visitDomain(visit).completeReturn(
          data.notes,
          data.settlement,
        );
      } catch (error) {
        if (error instanceof VisitBalanceError && data.settlement) {
          this.assertValidSettlement(
            this.visitDomain(visit).balance(),
            data.settlement,
          );
        }
        this.rethrowVisitRule(error);
      }

      const missingPartsEvents = this.buildMissingPartsEvents(
        visit,
        data.missingParts,
      );

      await this.updateVisitWithVersion(tx, visitId, visit.version, {
        status: decision.visitStatus,
        notes: decision.notes,
      });
      const completedVisit = {
        id: visit.id,
        visitCode: visit.visitCode,
        status: decision.visitStatus,
      };
      if (decision.settlement) {
        await tx.visitMoneyOperation.create({
          data: {
            visitId,
            kind: decision.settlement.kind,
            amount: decision.settlement.amount,
          },
        });
      }
      await tx.order.updateMany({
        where: { visitId: visitId, deletedAt: null },
        data: { status: decision.orderStatus },
      });

      const deposit = visit.deposits[0];
      const returnsDeposit =
        data.depositReturned &&
        deposit !== undefined &&
        deposit.type !== 'none' &&
        !deposit.returned;
      if (returnsDeposit && deposit) {
        await tx.deposit.update({
          where: { id: deposit.id, deletedAt: null },
          data: { returned: true },
        });
      }

      const orderSnapshots = visit.orders.map((order) => ({
        orderId: order.id,
        childName: order.child.name,
        costumeName: order.costume.name,
        inventoryCode: order.costume.inventoryCode,
        rentPrice: order.rentPrice,
        prepaymentAmount: order.prepaymentAmount,
      }));
      const auditEvents: VisitAuditEventInput[] = [
        {
          action: 'visit.completed',
          entityType: 'visit',
          entityId: visit.id,
          visitId: visit.id,
          payload: {
            kind: 'visit.completed',
            visitCode: visit.visitCode,
            orders: orderSnapshots,
            ...(decision.settlement
              ? {
                  settlementKind: decision.settlement.kind,
                  settlementAmount: decision.settlement.amount,
                }
              : {}),
          },
        },
      ];
      // «Вернули без: …» — только запись в истории, на деньги и статусы не влияет
      auditEvents.push(...missingPartsEvents);
      if (decision.settlement) {
        auditEvents.push(
          decision.settlement.kind === 'customer_refund'
            ? {
                action: 'money.refunded',
                entityType: 'visit',
                entityId: visit.id,
                visitId: visit.id,
                payload: {
                  kind: 'money.refunded',
                  amount: decision.settlement.amount,
                },
              }
            : {
                action: 'money.received',
                entityType: 'visit',
                entityId: visit.id,
                visitId: visit.id,
                payload: {
                  kind: 'money.received',
                  moneyKind: 'debt_payment',
                  amount: decision.settlement.amount,
                },
              },
        );
      }
      if (returnsDeposit && deposit) {
        auditEvents.push({
          action: 'deposit.returned',
          entityType: 'visit',
          entityId: visit.id,
          visitId: visit.id,
          payload: {
            kind: 'deposit.returned',
            depositType: deposit.type,
            amount: deposit.amount ?? 0,
          },
        });
      }
      await this.recordAuditEvents(tx, actor, commandId, auditEvents);

      return { completedVisit, decision };
    });

    return {
      visitId: result.completedVisit.id,
      visitCode: result.completedVisit.visitCode,
      status: result.completedVisit.status as 'completed',
      message: 'Визит успешно завершен, все костюмы возвращены',
      balance: result.decision.balance,
    };
  }

  /** События истории о частях, которых не оказалось при возврате; проверяет, что они были выданы. */
  private buildMissingPartsEvents(
    visit: {
      id: number;
      visitCode: string;
      orders: Array<{
        id: number;
        issuedParts: unknown;
        child: { name: string };
        costume: { name: string; inventoryCode: string; parts: unknown };
      }>;
    },
    missingParts: ReturnMissingPartsDto[] | undefined,
  ): VisitAuditEventInput[] {
    if (!missingParts || missingParts.length === 0) return [];

    const ordersById = new Map(visit.orders.map((order) => [order.id, order]));
    const seenOrderIds = new Set<number>();
    const events: VisitAuditEventInput[] = [];

    for (const entry of missingParts) {
      const order = ordersById.get(entry.orderId);
      if (!order) {
        throw new BadRequestException(
          `Заказ ${entry.orderId} не относится к этому визиту`,
        );
      }
      if (seenOrderIds.has(order.id)) {
        throw new BadRequestException(
          `Недостающие части заказа ${order.id} указаны дважды`,
        );
      }
      seenOrderIds.add(order.id);

      const issued = orderCostumeParts(order);
      const names: string[] = [];
      for (const requested of entry.parts) {
        const match = issued.find((part) =>
          isSameCostumePartName(part.name, requested),
        );
        if (!match) {
          throw new BadRequestException(
            `Части «${requested}» нет в составе костюма «${order.costume.name}»`,
          );
        }
        if (!names.includes(match.name)) names.push(match.name);
      }

      events.push({
        action: 'return.missing_parts',
        entityType: 'order',
        entityId: order.id,
        visitId: visit.id,
        orderId: order.id,
        payload: {
          kind: 'return.missing_parts',
          visitCode: visit.visitCode,
          orderId: order.id,
          childName: order.child.name,
          costumeName: order.costume.name,
          inventoryCode: order.costume.inventoryCode,
          parts: names,
        },
      });
    }
    return events;
  }

  async getVisitBalance(visitId: number): Promise<VisitBalanceDto> {
    const visit = await this.prisma.visit.findFirst({
      where: { id: visitId, deletedAt: null },
      include: {
        orders: { where: { deletedAt: null } },
        moneyOperations: { where: { voidedAt: null } },
      },
    });
    if (!visit) throw new NotFoundException(`Визит №${visitId} не найден`);
    try {
      return this.visitDomain(visit).availableBalance();
    } catch (error) {
      this.rethrowVisitRule(error);
    }
  }

  async settleVisit(
    visitId: number,
    settlement: VisitSettlementRequestDto,
    actor: VisitAuditActor,
  ): Promise<VisitBalanceDto> {
    const commandId = randomUUID();
    try {
      return await this.withSerializableTransaction(async (tx) => {
        const visit = await tx.visit.findFirst({
          where: { id: visitId, deletedAt: null },
          include: {
            orders: { where: { deletedAt: null } },
            moneyOperations: { where: { voidedAt: null } },
          },
        });
        if (!visit) throw new NotFoundException(`Визит №${visitId} не найден`);
        let nextBalance;
        try {
          nextBalance = this.visitDomain(visit).settle(settlement);
        } catch (error) {
          if (error instanceof VisitBalanceError) {
            this.assertValidSettlement(
              this.visitDomain(visit).balance(),
              settlement,
            );
          }
          this.rethrowVisitRule(error);
        }
        await tx.visitMoneyOperation.create({
          data: {
            visitId,
            kind: settlement.kind,
            amount: settlement.amount,
          },
        });
        await this.recordAuditEvents(tx, actor, commandId, [
          settlement.kind === 'customer_refund'
            ? {
                action: 'money.refunded',
                entityType: 'visit',
                entityId: visit.id,
                visitId: visit.id,
                payload: {
                  kind: 'money.refunded',
                  amount: settlement.amount,
                },
              }
            : {
                action: 'money.received',
                entityType: 'visit',
                entityId: visit.id,
                visitId: visit.id,
                payload: {
                  kind: 'money.received',
                  moneyKind: 'debt_payment',
                  amount: settlement.amount,
                },
              },
        ]);
        await this.updateVisitWithVersion(tx, visitId, visit.version);
        return nextBalance;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException(
          'Баланс изменился. Обновите данные и повторите расчёт',
        );
      }
      throw error;
    }
  }

  async visitHistory(
    visitId: number,
    page = 1,
    limit = 20,
  ): Promise<PaginatedVisitHistoryResponseDto> {
    if (!Number.isInteger(page) || page < 1) {
      throw new BadRequestException('Номер страницы должен быть не меньше 1');
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException('Размер страницы должен быть от 1 до 100');
    }

    const visit = await this.prisma.visit.findFirst({
      where: { id: visitId, deletedAt: null },
      select: { id: true },
    });
    if (!visit) {
      throw new NotFoundException(`Визит с ID ${visitId} не найден`);
    }

    const skip = (page - 1) * limit;
    const where = { visitId };
    const [events, total] = await this.prisma.$transaction([
      this.prisma.auditEvent.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.auditEvent.count({ where }),
    ]);

    return PaginatedVisitHistoryResponseSchema.parse({
      items: events.map((event) => {
        if (event.schemaVersion !== 1) {
          throw new InternalServerErrorException(
            'Версия данных истории визита не поддерживается',
          );
        }
        const { actorUserId, orderId, ...eventData } = event;
        return VisitHistoryEventSchema.parse({
          ...eventData,
          occurredAt: event.occurredAt.toISOString(),
          ...(orderId === null ? {} : { orderId }),
          ...(actorUserId === null ? {} : { actorUserId }),
        });
      }),
      total,
      page,
      limit,
      hasMore: skip + events.length < total,
    });
  }

  async listUnsettledVisitBalances(
    page = 1,
    limit = 20,
  ): Promise<PaginatedUnsettledVisitBalancesResponseDto> {
    const visits = await this.prisma.visit.findMany({
      where: { status: 'completed', deletedAt: null },
      orderBy: { id: 'desc' },
      select: {
        id: true,
        visitCode: true,
        client: { select: { name: true, phone: true } },
        orders: {
          where: { deletedAt: null },
          select: { rentPrice: true, prepaymentAmount: true },
        },
        moneyOperations: {
          where: { voidedAt: null },
          select: { kind: true, amount: true },
        },
      },
    });
    const unsettled = visits
      .map((visit) => ({
        visitId: visit.id,
        visitCode: visit.visitCode,
        clientName: visit.client.name,
        clientPhone: visit.client.phone,
        balance: calculateVisitBalance({
          orders: visit.orders,
          operations: visit.moneyOperations,
        }),
      }))
      .filter((visit) => visit.balance.signedBalance !== 0);
    const skip = (page - 1) * limit;
    return {
      items: unsettled.slice(skip, skip + limit),
      total: unsettled.length,
      page,
      limit,
      hasMore: skip + limit < unsettled.length,
    };
  }

  async visitUnreturnedDeposits(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const whereCondition = {
      status: 'completed' as const,
      deletedAt: null,
      deposits: {
        some: {
          deletedAt: null,
          returned: false,
          type: { not: 'none' as const },
        },
      },
    };

    const [total, visits] = await this.prisma.$transaction([
      this.prisma.visit.count({ where: whereCondition }),
      this.prisma.visit.findMany({
        where: whereCondition,
        skip,
        take: limit,
        orderBy: {
          endDateTime: 'desc',
        },
        include: {
          client: true,
          deposits: { where: { deletedAt: null }, take: 1 },
          orders: {
            where: { deletedAt: null },
            include: {
              child: true,
              costume: true,
            },
          },
        },
      }),
    ]);

    const items = visits.map((visit) => {
      const childrenNames = Array.from(
        new Set(visit.orders.map((order) => order.child.name)),
      ).join(', ');

      const costumeNames = visit.orders
        .map((order) => order.costume.name)
        .join(', ');

      const deposit = visit.deposits[0];
      return {
        visitId: visit.id,
        visitCode: visit.visitCode,
        childrenNames,
        costumeNames,
        startDateTime: visit.startDateTime.toISOString().split('T')[0],
        endDateTime: visit.endDateTime.toISOString().split('T')[0],
        clientPhone: visit.client.phone,
        clientName: visit.client.name,
        deposit: {
          type: deposit?.type || 'none',
          amount: deposit?.amount ?? undefined,
        },
        notes: visit.notes || '',
      };
    });

    return {
      items,
      total,
      page,
      limit,
      hasMore: skip + limit < total,
    };
  }

  async visitIssued(
    page: number = 1,
    limit: number = 20,
  ): Promise<visitIssuedResponseDto> {
    const skip = (page - 1) * limit;
    const whereCondition = {
      status: 'issued' as const,
      deletedAt: null,
    };

    const [total, visits] = await this.prisma.$transaction([
      this.prisma.visit.count({ where: whereCondition }),
      this.prisma.visit.findMany({
        where: whereCondition,
        skip,
        take: limit,
        orderBy: {
          endDateTime: 'asc',
        },
        include: {
          client: true,
          deposits: { where: { deletedAt: null }, take: 1 },
          orders: {
            where: { deletedAt: null },
            include: {
              child: true,
              costume: true,
            },
          },
        },
      }),
    ]);

    const items = visits.map((visit) => {
      const childrenNames = Array.from(
        new Set(visit.orders.map((order) => order.child.name)),
      ).join(', ');

      const costumesNames = visit.orders
        .map((order) => order.costume.name)
        .join(', ');

      const deposit = visit.deposits[0];
      return {
        visitId: visit.id,
        visitCode: visit.visitCode,
        childrenNames,
        costumesNames,
        startDateTime: visit.startDateTime.toISOString().split('T')[0],
        endDateTime: visit.endDateTime.toISOString().split('T')[0],
        clientPhone: visit.client.phone,
        clientName: visit.client.name,
        deposit: {
          type: deposit?.type || 'none',
          amount: deposit?.amount ? deposit.amount : undefined,
        },
      };
    });

    return {
      items,
      total,
      page,
      limit,
      hasMore: skip + limit < total,
    };
  }

  async visitCancel(
    visitId: number,
    data: visitCancelRequestDto,
    actor: VisitAuditActor,
  ) {
    const commandId = randomUUID();
    await this.withSerializableTransaction(async (tx) => {
      const visit = await tx.visit.findFirst({
        where: { id: visitId, deletedAt: null },
        include: {
          orders: {
            where: { deletedAt: null },
            include: {
              child: { select: { name: true } },
              costume: { select: { name: true, inventoryCode: true } },
            },
          },
        },
      });
      if (!visit) {
        throw new NotFoundException(`Визит с ID ${visitId} не найден`);
      }

      let decision;
      try {
        decision = this.visitDomain({
          status: visit.status,
          notes: visit.notes,
          orders: [],
          moneyOperations: [],
        }).cancel(data.reason);
      } catch (error) {
        this.rethrowVisitRule(error);
      }

      await tx.order.updateMany({
        where: { visitId: visitId, deletedAt: null },
        data: { status: decision.orderStatus },
      });

      await this.updateVisitWithVersion(tx, visitId, visit.version, {
        status: decision.visitStatus,
        notes: decision.notes,
      });
      await this.recordAuditEvents(tx, actor, commandId, [
        {
          action: 'visit.cancelled',
          entityType: 'visit',
          entityId: visit.id,
          visitId: visit.id,
          payload: {
            kind: 'visit.cancelled',
            visitCode: visit.visitCode,
            ...(data.reason ? { reason: data.reason } : {}),
          },
        },
      ]);
    });
  }

  async visitNotification(
    page: number = 1,
    limit: number = 20,
  ): Promise<visitNotificationResponseDto> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const skip = (page - 1) * limit;

    const activeVisit = { visit: { deletedAt: null } };
    const [total, totalToday, notifications] = await this.prisma.$transaction([
      this.prisma.notification.count({ where: activeVisit }),

      this.prisma.notification.count({
        where: {
          ...activeVisit,
          createdAt: {
            gte: startOfDay,
          },
        },
      }),

      this.prisma.notification.findMany({
        skip,
        take: limit,
        where: activeVisit,
        orderBy: { createdAt: 'desc' },
        include: {
          visit: {
            include: {
              client: true,
              orders: {
                where: { deletedAt: null },
                include: {
                  child: true,
                  costume: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const items = notifications.map((notif) => {
      const visit = notif.visit;
      const childrenNames = Array.from(
        new Set(visit.orders.map((o) => o.child.name)),
      ).join(', ');

      const costumeNames = visit.orders.map((o) => o.costume.name).join(', ');

      const message = buildVisitMessage(visit);
      return {
        notificationId: notif.id,
        status: notif.status,
        visitCode: visit.visitCode,
        clientName: visit.client.name,
        clientPhone: visit.client.phone,
        childrenNames,
        costumeNames,
        message,
      };
    });

    return {
      items,
      page,
      limit,
      total,
      hasMore: page * limit < total,
      totalToday,
    };
  }

  async searchNotification(search: string): Promise<searchNotificationDto[]> {
    const normalizedSearch = normalizeSearchQuery(search);
    if (!isSearchQueryReady(normalizedSearch)) return [];

    const wordFilters = buildWordStartFilters(normalizedSearch);
    const identifierFilters = buildIdentifierFilters(normalizedSearch);
    const phoneFilters = buildPhoneFilters(normalizedSearch);

    const searchFilters: Prisma.VisitWhereInput[] = [
      ...identifierFilters.map((filter) => ({ visitCode: filter })),
      ...wordFilters.map((filter) => ({ client: { name: filter } })),
      ...phoneFilters.map((filter) => ({ client: { phone: filter } })),
      ...wordFilters.map((filter) => ({
        orders: {
          some: {
            deletedAt: null,
            child: {
              name: filter,
            },
          },
        },
      })),
    ];

    const notifications = await this.prisma.notification.findMany({
      take: 20,
      where: {
        visit: {
          deletedAt: null,
          OR: searchFilters,
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        visit: {
          include: {
            client: true,
            orders: {
              where: { deletedAt: null },
              include: {
                child: true,
                costume: true,
              },
            },
          },
        },
      },
    });

    return sortBySearchScore(notifications, (notification) => {
      const visit = notification.visit;

      return maxScore([
        scoreIdentifierMatch(visit.visitCode, normalizedSearch),
        scoreTextMatch(visit.client.name, normalizedSearch),
        scorePhoneMatch(visit.client.phone, normalizedSearch),
        ...visit.orders.map((order) =>
          scoreTextMatch(order.child.name, normalizedSearch),
        ),
      ]);
    }).map((notif) => {
      const visit = notif.visit;
      const childrenNames = Array.from(
        new Set(visit.orders.map((o) => o.child.name)),
      ).join(', ');

      const costumeNames = visit.orders.map((o) => o.costume.name).join(', ');

      const message = buildVisitMessage(visit);

      return {
        notificationId: notif.id,
        status: notif.status,
        visitCode: visit.visitCode,
        clientName: visit.client.name,
        clientPhone: visit.client.phone,
        childrenNames,
        costumeNames,
        message,
      };
    });
  }
}

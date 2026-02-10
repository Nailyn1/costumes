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
} from '@costumes/shared';
import { Prisma } from '../prisma/generated/client';

@Injectable()
export class VisitOrderService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectQueue('notifications') private readonly notificationQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  private parseDateTime(dateStr: string, timeStr: string): Date {
    return new Date(`${dateStr}T${timeStr}:00`);
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
  ): Promise<CreateVisitResponseDto> {
    const fullStartDt = this.parseDateTime(
      data.startDateTime,
      data.issueTimeFrom,
    );
    const fullEndDt = this.parseDateTime(
      data.endDateTime,
      data.returnTimeUntil,
    );

    if (fullStartDt > fullEndDt) {
      throw new BadRequestException(
        'Дата начала не может быть позже даты возврата',
      );
    }

    const redisKey = `visit_code_lock:${data.visitCode}`;
    const isReserved = await this.redis.get(redisKey);
    if (!isReserved) {
      throw new ConflictException(
        'Код визита не найден в резерве или его время истекло',
      );
    }

    const costumeIds = data.orders.map((o) => o.costumeId);
    const busyCostumes = await this.isSuitAvailability(
      costumeIds,
      fullStartDt,
      fullEndDt,
    );

    if (busyCostumes.length > 0) {
      const names = busyCostumes.map((c) => `"${c.name}"`).join(', ');

      throw new BadRequestException(
        `Бронирование невозможно. Костюмы: ${names} уже заняты в этот промежуток времени.`,
      );
    }

    for (const order of data.orders) {
      if (order.rentPrice < order.prepaymentAmount) {
        throw new BadRequestException(
          `Цена аренды (${order.rentPrice}) не может быть меньше предоплаты (${order.prepaymentAmount})`,
        );
      }
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const client = await tx.client.findUnique({
          where: { id: data.clientId },
        });
        if (!client)
          throw new NotFoundException(`Клиент с ID ${data.clientId} не найден`);

        const visit = await tx.visit.create({
          data: {
            visitCode: data.visitCode,
            clientId: data.clientId,
            startDateTime: fullStartDt,
            endDateTime: fullEndDt,
            issueTimeFrom: data.issueTimeFrom,
            issueTimeTo: data.issueTimeTo,
            returnTimeUntil: data.returnTimeUntil,
            orders: {
              create: data.orders.map((o) => ({
                ...o,
                clientId: data.clientId,
                startDateTime: fullStartDt,
                endDateTime: fullEndDt,
              })),
            },
            notifications: {
              create: {
                type: 'booking_confirmation',
                status: 'pending',
              },
            },
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

        return visit;
      });
      await this.redis.del(redisKey);

      const pendingNotification = result.notifications[0];
      await this.notificationQueue.add('send-whatsapp', {
        notificationId: pendingNotification.id,
      });

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
          prepayment: o.prepaymentAmount,
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

  async isSuitAvailability(
    costumeIds: number[],
    startDateTime: Date,
    endDateTime: Date,
  ): Promise<{ id: number; name: string }[]> {
    const conflicts = await this.prisma.order.findMany({
      where: {
        costumeId: { in: costumeIds },
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
}

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
  GetVisitForIssueDto,
  GetVisitReservedDto,
  GetVisitReturnSearchDto,
  GetVisitSearchDto,
  GetVisitsForReturnDto,
  IssuedForReturnDto,
  MarkDepositReturnedDto,
  OrdersNotWrittenResponseDto,
  OrdersNotWrittenResponseSchema,
  VisitIssueRequestDto,
} from '@costumes/shared';
import { OrderStatus, Prisma } from '../prisma/generated/client';

@Injectable()
export class VisitOrderService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectQueue('notifications') private readonly notificationQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  private parseDateTime(dateStr: string, timeStr: string): Date {
    return new Date(`${dateStr}T${timeStr}:00Z`);
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

  async findOrdersNotWritten(): Promise<OrdersNotWrittenResponseDto> {
    const orders = await this.prisma.order.findMany({
      where: {
        tagStatus: 'not_written',
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

    const items = orders.map((order) => ({
      orderId: order.id,
      inventoryCode: order.costume.inventoryCode,
      costumeName: order.costume.name,
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

  async orderMarkTagWritten(orderId: number): Promise<void> {
    await this.prisma.order
      .update({
        where: { id: orderId },
        data: { tagStatus: 'written' },
      })
      .catch(() => {
        throw new NotFoundException(`Order with ID ${orderId} not found`);
      });
  }

  async visitIssue(data: VisitIssueRequestDto, visitId: number): Promise<void> {
    const { deposit, additionalPayment } = data;

    await this.prisma.$transaction(async (tx) => {
      const visit = await tx.visit.findUnique({
        where: { id: visitId },
        include: { orders: true },
      });

      if (!visit) {
        throw new NotFoundException(`Визит с ID ${visitId} не найден`);
      }

      if (visit.status === 'issued') {
        throw new BadRequestException('Визит уже имеет статус "Выдан"');
      }

      let remainingPayment = additionalPayment;

      for (const order of visit.orders) {
        const totalCost = order.rentPrice;
        const alreadyPaid = order.prepaymentAmount;
        const debt = totalCost - alreadyPaid;

        const paymentForThisOrder = Math.min(remainingPayment, debt);
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'issued',
            finalPayment: paymentForThisOrder,
          },
        });
        remainingPayment -= paymentForThisOrder;
      }

      await tx.visit.update({
        where: { id: visitId },
        data: {
          status: 'issued',
          notes: data.notes ?? visit.notes,
        },
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
    });
  }

  async visitReserved(date?: string): Promise<GetVisitReservedDto[]> {
    const targetDate = date ? new Date(date) : new Date();

    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const visits = await this.prisma.visit.findMany({
      where: {
        startDateTime: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: 'reserved',
      },
      include: {
        client: true,
        orders: {
          include: {
            child: true,
            costume: true,
          },
        },
      },
      orderBy: {
        startDateTime: 'asc',
      },
    });
    return visits.map((visit) => {
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
      };
    });
  }

  async visitSearch(q: string): Promise<GetVisitSearchDto[]> {
    const visits = await this.prisma.visit.findMany({
      where: {
        status: 'reserved',
        OR: [
          { visitCode: { contains: q, mode: 'insensitive' } },
          {
            orders: {
              some: {
                OR: [
                  { child: { name: { contains: q, mode: 'insensitive' } } },
                  { costume: { name: { contains: q, mode: 'insensitive' } } },
                  {
                    costume: {
                      inventoryCode: { contains: q, mode: 'insensitive' },
                    },
                  },
                ],
              },
            },
          },
        ],
      },
      include: {
        client: true,
        orders: {
          include: {
            child: true,
            costume: true,
          },
        },
      },
      take: 50,
    });

    return visits.map((visit) => ({
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
    const visit = await this.prisma.visit.findUnique({
      where: { id: visitId },
      include: {
        client: true,
        orders: {
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
      totalRentPrice,
      totalPrepayment,
      remainingToPay,
      notes: visit.notes || '',
      orders: visit.orders.map((order) => ({
        orderId: order.id,
        childName: order.child.name,
        costumeName: order.costume.name,
        inventoryCode: order.costume.inventoryCode,
        rentPrice: order.rentPrice,
        prepaymentAmount: order.prepaymentAmount,
        tagStatus: order.tagStatus as 'written' | 'not_written',
      })),
    };
  }

  async visitsIssuedForReturn(): Promise<IssuedForReturnDto[]> {
    const visits = await this.prisma.visit.findMany({
      where: {
        status: 'issued',
      },
      include: {
        client: true,
        orders: {
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
        childrenNames,
        costumeNames,
        endDateTime: visit.endDateTime.toISOString().split('T')[0],
        clientPhone: visit.client.phone,
        notes: visit.notes || '',
      };
    });
  }

  async visitsReturnSearch(q: string): Promise<GetVisitReturnSearchDto[]> {
    const visits = await this.prisma.visit.findMany({
      where: {
        status: 'issued',
        deletedAt: null,
        OR: [
          { visitCode: { contains: q, mode: 'insensitive' } },
          { client: { phone: { contains: q, mode: 'insensitive' } } },
          { client: { name: { contains: q, mode: 'insensitive' } } },
          {
            orders: {
              some: {
                OR: [
                  { child: { name: { contains: q, mode: 'insensitive' } } },
                  { costume: { name: { contains: q, mode: 'insensitive' } } },
                  {
                    costume: {
                      inventoryCode: { contains: q, mode: 'insensitive' },
                    },
                  },
                ],
              },
            },
          },
        ],
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
      take: 50,
    });

    return visits.map((visit) => {
      const childrenSet = new Set(visit.orders.map((o) => o.child.name));
      const costumesSet = new Set(visit.orders.map((o) => o.costume.name));
      return {
        visitId: visit.id,
        visitCode: visit.visitCode,
        childrenNames: Array.from(childrenSet).join(', '),
        costumeNames: Array.from(costumesSet).join(', '),
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
        deposit: true,
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

    return {
      visitId: visit.id,
      visitCode: visit.visitCode,
      client: {
        name: visit.client.name,
        phone: visit.client.phone,
      },
      startDateTime: visit.startDateTime.toISOString(),
      endDateTime: visit.endDateTime.toISOString(),
      notes: visit.notes || '',
      orders: visit.orders.map((order) => ({
        orderId: order.id,
        childName: order.child.name,
        costumeName: order.costume.name,
        inventoryCode: order.costume.inventoryCode,
        rentPrice: order.rentPrice,
        prepaymentAmount: order.prepaymentAmount,
        finalPayment: order.finalPayment ?? 0,
        returned: order.status === OrderStatus.returned,
      })),
      deposit: {
        type: visit.deposit?.type || 'none',
        amount: visit.deposit?.amount || 0,
      },
    };
  }

  async MarkDepositReturned(
    visitId: number,
    notes?: string,
  ): Promise<MarkDepositReturnedDto> {
    const visit = await this.prisma.visit.findUnique({
      where: { id: visitId },
      include: { deposit: true },
    });

    if (!visit) {
      throw new NotFoundException(`Визит с ID ${visitId} не найден`);
    }

    if (!visit.deposit) {
      throw new BadRequestException(
        `Для визита №${visitId} залог не зафиксирован`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.deposit.update({
        where: { visitId: visitId },
        data: { returned: true },
      });

      if (notes) {
        const currentNotes = visit.notes ? `${visit.notes}\n` : '';
        await tx.visit.update({
          where: { id: visitId },
          data: {
            notes: `${currentNotes}[Возврат залога]: ${notes}`,
          },
        });
      }
    });

    return {
      visitId: visitId,
      depositReturned: true,
      message: 'Статус депозита успешно обновлен',
    };
  }
}

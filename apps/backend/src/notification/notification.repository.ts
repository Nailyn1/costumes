import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findClientIdsWithConfirmedWhatsapp(
    clientIds: number[],
  ): Promise<Set<number>> {
    if (clientIds.length === 0) return new Set();
    const notifications = await this.prisma.notification.findMany({
      where: {
        status: { in: ['delivered', 'read', 'isConfirmed'] },
        visit: {
          clientId: { in: clientIds },
          client: { deletedAt: null },
        },
      },
      select: {
        createdAt: true,
        visit: {
          select: {
            clientId: true,
            client: { select: { updatedAt: true } },
          },
        },
      },
    });
    return new Set(
      notifications
        .filter(({ createdAt, visit }) => visit.client.updatedAt <= createdAt)
        .map(({ visit }) => visit.clientId),
    );
  }

  countCreatedSince(date: Date) {
    return this.prisma.notification.count({
      where: { createdAt: { gte: date } },
    });
  }

  findForSending(notificationId: number) {
    return this.prisma.notification.findUnique({
      where: { id: notificationId },
      include: {
        visit: {
          include: {
            client: true,
            orders: { include: { child: true, costume: true } },
          },
        },
      },
    });
  }

  findById(notificationId: number) {
    return this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
  }

  findWithVisit(notificationId: number) {
    return this.prisma.notification.findUnique({
      where: { id: notificationId },
      include: { visit: true },
    });
  }

  updateClientPhoneAndQueueResend(
    notificationId: number,
    clientId: number,
    newPhone: string,
    traceId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.client.update({
        where: { id: clientId },
        data: { phone: newPhone },
      });
      await tx.notification.update({
        where: { id: notificationId },
        data: { status: 'pending', errorText: null, traceId },
      });
    });
  }
}

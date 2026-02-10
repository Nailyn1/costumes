import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationStatus, Prisma } from '../prisma/generated/client';
import { UnrecoverableError } from 'bullmq';
import { WhatsappProvider } from './whatsapp.provider';
import { REDIS_CLIENT } from '../redis/redis.constants';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

type VisitWithDetails = Prisma.VisitGetPayload<{
  include: {
    client: true;
    orders: {
      include: {
        child: true;
        costume: true;
      };
    };
  };
}>;

const STATUS_PRIORITY: Record<string, number> = {
  failed: 0,
  pending: 1,
  sent: 2,
  delivered: 3,
  read: 4,
  isConfirmed: 5,
  noAccount: 6,
};

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly prisma: PrismaService,
    private readonly whatsappProvider: WhatsappProvider,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    this.logger.log(
      'The application is running. Syncing the WhatsApp status...',
    );
    await this.syncWhatsappStatus();
  }

  async syncWhatsappStatus() {
    const instanceId = Number(this.configService.get('GREEN_API_ID_INSTANCE'));
    const state = await this.whatsappProvider.getStateInstance();
    const currentTimestamp = Math.floor(Date.now() / 1000);

    await this.handleInstanceStateChange(instanceId, state, currentTimestamp);
  }

  async processWhatsAppSending(notificationId: number) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      include: {
        visit: {
          include: {
            client: true,
            orders: {
              include: {
                child: true,
                costume: true,
              },
            },
          },
        },
      },
    });

    if (!notification || !notification.visit) {
      this.logger.error(`[Fatal] Notification ${notificationId} not found`);
      throw new UnrecoverableError(
        `Notification ${notificationId} missing in DB`,
      );
    }

    try {
      const message = this.buildVisitMessage(
        notification.visit as VisitWithDetails,
      );

      const rawPhone = notification.visit.client.phone;

      this.logger.log(
        `Attempting to send WhatsApp to ${rawPhone} for visit ${notification.visit.visitCode}`,
      );

      const externalId = await this.whatsappProvider.sendMessage(
        rawPhone,
        message,
      );

      await this.prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: 'sent',
          externalId: externalId,
          errorText: null,
        },
      });

      this.logger.log(
        `Notification ${notificationId} successfully sent. External ID: ${externalId}`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(
        `Failed to send notification ${notificationId}: ${errorMessage}`,
      );

      await this.prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: 'failed',
          errorText: errorMessage,
        },
      });

      throw error;
    }
  }

  async changeOutgoingStatus(idMessage: string, newStatus: string) {
    const incomingPriority = STATUS_PRIORITY[newStatus] ?? -1;

    const currentNotification = await this.prisma.notification.findUnique({
      where: { externalId: idMessage },
      select: { status: true, id: true },
    });

    if (!currentNotification) return;

    const currentPriority = STATUS_PRIORITY[currentNotification.status] ?? 0;

    if (incomingPriority > currentPriority) {
      await this.prisma.notification.update({
        where: { id: currentNotification.id },
        data: { status: newStatus as NotificationStatus },
      });
      this.logger.log(
        `Status updated: ${currentNotification.status} -> ${newStatus} for ${idMessage}`,
      );
    }
  }

  async changeIncomingStatus(chatId: string) {
    const phone = chatId.split('@')[0];
    const formattedPhone = `+${phone}`;

    const lastNotification = await this.prisma.notification.findFirst({
      where: {
        createdAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
        visit: { client: { phone: formattedPhone } },
        status: { in: ['sent', 'delivered', 'read'], not: 'isConfirmed' },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (lastNotification) {
      await this.prisma.notification.update({
        where: { id: lastNotification.id },
        data: { status: 'isConfirmed' as NotificationStatus },
      });

      this.logger.log(
        `Notification #${lastNotification.id} (Visit ${lastNotification.visitId}) is confirmed`,
      );
    }
  }

  async handleInstanceStateChange(
    instanceId: number,
    newState: string,
    timestamp: number,
  ) {
    const statusKey = `whatsapp:instance:${instanceId}:status`;
    const tsKey = `whatsapp:instance:${instanceId}:last_ts`;

    const lastTs = await this.redis.get(tsKey);

    if (!lastTs || timestamp >= Number(lastTs)) {
      await this.redis.set(statusKey, newState);
      await this.redis.set(tsKey, timestamp);

      this.logger.log(
        `Status if instance ${instanceId} updated: ${newState} (ts: ${timestamp})`,
      );
    } else {
      this.logger.warn(
        `The outdated instance status was ingored: received${newState} (${timestamp}), but in db these data already exist from ${lastTs}`,
      );
    }
  }

  async isInstanceAuthorized(): Promise<boolean> {
    const instanceId = this.configService.get<string>('INSTANCE_ID');
    const statusKey = `whatsapp:instance:${instanceId}:status`;

    const status = await this.redis.get(statusKey);
    return status === 'authorized';
  }

  private buildVisitMessage(visit: VisitWithDetails): string {
    const { orders, client, visitCode } = visit;

    const formatDate = (date: Date) => date.toLocaleDateString('ru-RU');
    const startDate = formatDate(visit.startDateTime);
    const endDate = formatDate(visit.endDateTime);

    const totalRent = orders.reduce((sum, o) => sum + o.rentPrice, 0);
    const totalPrepayment = orders.reduce(
      (sum, o) => sum + o.prepaymentAmount,
      0,
    );
    const balance = totalRent - totalPrepayment;

    const ordersList = orders
      .map((o, index) => {
        return `${index + 1}. *${o.child.name}*: ${o.costume.name}\n   Цена: ${o.rentPrice} | Внесено: ${o.prepaymentAmount}`;
      })
      .join('\n');

    let message = `Здравствуйте, ${client.name}! \n`;
    message += `Ваши костюмы забронированы. \n\n`;
    message += `Код выдачи: *${visitCode}*\n\n`;

    message += `*ДЕТАЛИ ЗАКАЗА:*\n`;
    message += `${ordersList}\n\n`;

    if (orders.length > 1) {
      message += `*ИТОГО:*\n💰 Общая стоимость: ${totalRent}\n💳 Всего внесено: ${totalPrepayment}\n📉 Остаток к оплате: *${balance}*\n\n`;
    } else if (balance > 0) {
      message += `📉 Остаток к оплате: *${balance}*\n\n`;
    }

    message += `🗓 *ГРАФИК:*\n📍 Выдача: ${startDate} (с ${visit.issueTimeFrom} до ${visit.issueTimeTo})\n📅 Возврат: ${endDate} (до ${visit.returnTimeUntil})\n\n`;
    message += `⚠️ _Пожалуйста, ответьте на это сообщение любым символом или цифрой 1, чтобы подтвердить, что данные верны и мы забронировали костюм за вами окончательно_`;

    return message;
  }
}

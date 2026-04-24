import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationStatus, Prisma } from '../prisma/generated/client';
import { Queue, UnrecoverableError } from 'bullmq';
import { WhatsappProvider } from './whatsapp.provider';
import { REDIS_CLIENT } from '../redis/redis.constants';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Logger } from 'pino';
import { GreenApiWebhook } from './notification.controller';
import { InjectQueue } from '@nestjs/bullmq';
import { NotificationGateway } from './notification.gateway';

export type VisitWithDetails = Prisma.VisitGetPayload<{
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
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly prisma: PrismaService,
    private readonly whatsappProvider: WhatsappProvider,
    private readonly configService: ConfigService,
    @InjectPinoLogger(NotificationService.name)
    private readonly logger: PinoLogger,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
    @Inject(forwardRef(() => NotificationGateway))
    private readonly notificationGateway: NotificationGateway,
  ) {}

  async onModuleInit() {
    this.logger.info('Initializing module: Syncing WhatsApp status...');
    try {
      await this.syncWhatsappStatus();
      this.logger.info('WhatsApp status sync completed successfully');
    } catch (error) {
      this.logger.error(
        error,
        'Failed to sync WhatsApp status during application startup',
      );
    }
  }

  async syncWhatsappStatus() {
    const instanceId = Number(this.configService.get('GREEN_API_ID_INSTANCE'));
    const state = await this.whatsappProvider.getStateInstance();
    const currentTimestamp = Math.floor(Date.now() / 1000);

    await this.handleInstanceStateChange(instanceId, state, currentTimestamp);
  }

  async processWhatsAppSending(
    notificationId: number,
    loggerOverride?: Logger,
  ) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const totalToday = await this.prisma.notification.count({
      where: { createdAt: { gte: startOfDay } },
    });
    const l: Logger =
      loggerOverride || (this.logger.logger as unknown as Logger);
    const traceId = l.bindings().traceId;
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
      l.error({ notificationId }, 'Notification or visit not found in DB');
      throw new UnrecoverableError(
        `Notification ${notificationId} missing in DB`,
      );
    }

    const { visit } = notification;
    const visitCode = visit.visitCode;
    const phone = visit.client.phone;

    try {
      const message = this.buildVisitMessage(
        notification.visit as VisitWithDetails,
      );

      const rawPhone = notification.visit.client.phone;

      l.info(
        { notificationId, visitCode, phone },
        'Attempting to send WhatsApp message',
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

      this.notificationGateway.emitNotificationStatusUpdate(
        {
          notificationId,
          status: 'sent',
          totalToday,
        },
        traceId as string,
      );
      l.info(
        { notificationId, externalId, visitCode },
        'Notification successfully sent and status updated',
      );
    } catch (error) {
      l.error(
        {
          err: error,
          notificationId,
          visitCode,
          phone,
        },
        'Failed to send WhatsApp notification',
      );
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      l.error(`Failed to send notification ${notificationId}: ${errorMessage}`);

      await this.prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: 'failed',
          errorText: errorMessage,
        },
      });

      this.notificationGateway.emitNotificationStatusUpdate(
        {
          notificationId,
          status: 'failed',
          totalToday,
        },
        traceId as string,
      );

      throw error;
    }
  }

  async handleManualResend(notificationId: number, logger: Logger) {
    logger.info('Starting manual resend process');
    const traceId = logger.bindings().traceId;
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new Error(`Notification ${notificationId} not found`);
    }

    const jobId = `notification-${notificationId}`;
    const existingJob = await this.notificationsQueue.getJob(jobId);

    if (existingJob) {
      logger.info({ jobId }, 'Found existing job in queue, removing it');
      await existingJob.remove();
    }

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: 'pending',
        errorText: null,
        traceId: traceId,
      },
    });

    await this.notificationsQueue.add(
      'send-whatsapp',
      { notificationId, traceId },
      { jobId },
    );

    logger.info('Successfully queued new job for resend');

    return { success: true };
  }

  async handleUpdatePhoneAndResend(
    notificationId: number,
    newPhone: string,
    logger: Logger,
  ) {
    const traceId = logger.bindings().traceId;
    logger.info('Starting phone update and resend process');

    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      include: { visit: true },
    });

    if (!notification || !notification.visit) {
      throw new Error(`Notification or related visit not found`);
    }

    const clientId = notification.visit.clientId;

    await this.prisma.$transaction(async (tx) => {
      await tx.client.update({
        where: { id: clientId },
        data: { phone: newPhone },
      });

      await tx.notification.update({
        where: { id: notificationId },
        data: {
          status: 'pending',
          errorText: null,
          traceId: traceId,
        },
      });
    });

    logger.info(
      { clientId },
      'Client phone and notification status updated in DB',
    );

    const jobId = `notification-${notificationId}`;
    const existingJob = await this.notificationsQueue.getJob(jobId);
    if (existingJob) {
      await existingJob.remove();
    }

    await this.notificationsQueue.add(
      'send-whatsapp',
      { notificationId, traceId },
      { jobId },
    );

    logger.info('Successfully queued new job for resend after phone update');

    return { success: true };
  }

  async changeOutgoingStatus(
    idMessage: string,
    newStatus: string,
    loggerOverride?: Logger,
  ) {
    const incomingPriority = STATUS_PRIORITY[newStatus] ?? -1;

    const currentNotification = await this.prisma.notification.findUnique({
      where: { externalId: idMessage },
      select: { status: true, id: true, traceId: true },
    });

    const l = this.getL(loggerOverride, currentNotification?.traceId);
    const traceId = l.bindings().traceId;
    if (!currentNotification) {
      l.warn(
        { idMessage, newStatus },
        'Received status update for non-existent notification',
      );
      return;
    }

    const currentPriority = STATUS_PRIORITY[currentNotification.status] ?? 0;

    if (incomingPriority > currentPriority) {
      const oldStatus = currentNotification.status;

      await this.prisma.notification.update({
        where: { id: currentNotification.id },
        data: { status: newStatus as NotificationStatus },
      });

      this.notificationGateway.emitNotificationStatusUpdate(
        {
          notificationId: currentNotification.id,
          status: newStatus,
        },
        traceId as string,
      );

      l.info(
        {
          idMessage,
          notificationId: currentNotification.id,
          oldStatus,
          newStatus,
          priorityChange: `${currentPriority} -> ${incomingPriority}`,
        },
        'Notification status updated',
      );
    } else {
      l.debug(
        {
          idMessage,
          currentStatus: currentNotification.status,
          ignoredStatus: newStatus,
        },
        'Status update skipped: lower or equal priority',
      );
    }
  }

  async changeIncomingStatus(chatId: string, loggerOverride?: Logger) {
    const phone = chatId.split('@')[0];
    const formattedPhone = `+${phone}`;

    try {
      const lastNotification = await this.prisma.notification.findFirst({
        where: {
          createdAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
          visit: { client: { phone: formattedPhone } },
          status: { in: ['sent', 'delivered', 'read'], not: 'isConfirmed' },
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, visitId: true, traceId: true },
      });

      const l = this.getL(loggerOverride, lastNotification?.traceId);
      const traceId = l.bindings().traceId;

      if (lastNotification) {
        await this.prisma.notification.update({
          where: { id: lastNotification.id },
          data: { status: 'isConfirmed' as NotificationStatus },
        });

        this.notificationGateway.emitNotificationStatusUpdate(
          {
            notificationId: lastNotification.id,
            status: 'isConfirmed',
          },
          traceId as string,
        );

        l.info(
          {
            notificationId: lastNotification.id,
            visitId: lastNotification.visitId,
            formattedPhone,
          },
          'Notification confirmed by client',
        );
      } else {
        l.debug(
          { formattedPhone },
          'Incoming message: No eligible notification found for confirmation',
        );
      }
    } catch (error) {
      const l = this.getL(loggerOverride);
      l.error(
        { err: error, formattedPhone, chatId },
        'Failed to process incoming status change',
      );
      throw error;
    }
  }

  async handleInstanceStateChange(
    instanceId: number,
    newState: string,
    timestamp: number,
    loggerOverride?: Logger,
  ) {
    const statusKey = `whatsapp:instance:${instanceId}:status`;
    const tsKey = `whatsapp:instance:${instanceId}:last_ts`;

    const l = this.getL(loggerOverride);

    try {
      const lastTs = await this.redis.get(tsKey);

      if (!lastTs || timestamp >= Number(lastTs)) {
        await this.redis.set(statusKey, newState);
        await this.redis.set(tsKey, timestamp);

        l.info(
          { instanceId, newState, timestamp },
          'WhatsApp instance status updated in Redis',
        );
      } else {
        l.warn(
          {
            instanceId,
            receivedState: newState,
            receivedTs: timestamp,
            existingTs: Number(lastTs),
          },
          'Outdated instance status ignored',
        );
      }
    } catch (error) {
      l.error(
        { err: error, instanceId, newState },
        'Failed to update instance state in Redis',
      );
      throw error;
    }
  }

  async isInstanceAuthorized(): Promise<boolean> {
    const instanceId = this.configService.get<string>('INSTANCE_ID');
    const statusKey = `whatsapp:instance:${instanceId}:status`;

    const status = await this.redis.get(statusKey);
    return status === 'authorized';
  }

  async getContextualLogger(body: GreenApiWebhook, req?: any): Promise<Logger> {
    let traceId: string | null = null;

    if (
      body.typeWebhook === 'outgoingMessageStatus' ||
      body.typeWebhook === 'outgoingAPIMessageStatus'
    ) {
      const notification = await this.prisma.notification.findUnique({
        where: { externalId: body.idMessage },
        select: { traceId: true },
      });
      traceId = notification?.traceId ?? null;
    } else if (body.typeWebhook === 'incomingMessageReceived') {
      const phone = body.senderData.chatId.split('@')[0];
      const formattedPhone = `+${phone}`;

      const lastNotification = await this.prisma.notification.findFirst({
        where: {
          visit: {
            client: {
              phone: { contains: formattedPhone },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        select: { traceId: true },
      });
      traceId = lastNotification?.traceId ?? null;
    }

    if (traceId && req) {
      req['traceId'] = traceId;
    }
    return traceId
      ? this.logger.logger.child({ traceId, webhookType: body.typeWebhook })
      : (this.logger.logger as unknown as Logger);
  }

  private getL(loggerOverride?: Logger, dbTraceId?: string | null): Logger {
    if (loggerOverride) return loggerOverride;

    if (dbTraceId) {
      return this.logger.logger.child({ traceId: dbTraceId }) as Logger;
    }

    return this.logger.logger as unknown as Logger;
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

    message += `❗️ *УСЛОВИЯ АРЕНДЫ:*\n`;
    message += `• Обязательный залог при выдаче — от 5 000 ₸.\n`;
    message += `• В случае отказа от брони предоплата не возвращается.\n\n`;

    message += `🗓 *ГРАФИК:*\n📍 Выдача: ${startDate} (с ${visit.issueTimeFrom} до ${visit.issueTimeTo})\n📅 Возврат: ${endDate} (до ${visit.returnTimeUntil})\n\n`;
    message += `⚠️ _Пожалуйста, ответьте на это сообщение любым символом или цифрой 1, чтобы подтвердить, что данные верны и мы забронировали костюм за вами окончательно_`;

    return message;
  }
}

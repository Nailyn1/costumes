import { UnrecoverableError } from 'bullmq';
import { NotificationService } from './notification.service';
import { createPrismaMock } from '../test-utils';

const { prisma, tx, reset } = createPrismaMock();

const makeLogger = () => {
  const l = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    bindings: jest.fn().mockReturnValue({ traceId: 'trace-1' }),
    child: jest.fn(),
  };
  l.child.mockReturnValue(l);
  return l;
};

describe('NotificationService', () => {
  let service: NotificationService;
  let redis: { get: jest.Mock; set: jest.Mock };
  let whatsapp: { sendMessage: jest.Mock; getStateInstance: jest.Mock };
  let queue: { getJob: jest.Mock; add: jest.Mock };
  let gateway: { emitNotificationStatusUpdate: jest.Mock };
  let config: { get: jest.Mock };
  let logger: ReturnType<typeof makeLogger>;
  let env: Record<string, string>;

  beforeEach(() => {
    reset();
    redis = { get: jest.fn(), set: jest.fn() };
    whatsapp = {
      sendMessage: jest.fn(),
      getStateInstance: jest.fn(),
    };
    queue = { getJob: jest.fn(), add: jest.fn() };
    gateway = { emitNotificationStatusUpdate: jest.fn() };
    env = { GREEN_API_ID_INSTANCE: '1101' };
    config = { get: jest.fn((key: string) => env[key]) };
    logger = makeLogger();
    service = new NotificationService(
      redis as never,
      prisma as never,
      whatsapp as never,
      config as never,
      { logger } as never,
      queue as never,
      gateway as never,
    );
  });

  describe('changeOutgoingStatus (status priority)', () => {
    const order = [
      'failed',
      'pending',
      'sent',
      'delivered',
      'read',
      'isConfirmed',
      'noAccount',
    ];
    const pairs = order.flatMap((current, ci) =>
      order.map((incoming, ii) => ({
        current,
        incoming,
        applied: ii > ci,
      })),
    );

    it.each(pairs)(
      '$current -> $incoming: applied=$applied',
      async ({ current, incoming, applied }) => {
        prisma.notification.findUnique.mockResolvedValue({
          id: 5,
          status: current,
          traceId: 't',
        });

        await service.changeOutgoingStatus('ext-1', incoming, logger as never);

        if (applied) {
          expect(prisma.notification.update).toHaveBeenCalledWith({
            where: { id: 5 },
            data: { status: incoming },
          });
          expect(gateway.emitNotificationStatusUpdate).toHaveBeenCalledWith(
            { notificationId: 5, status: incoming },
            'trace-1',
          );
        } else {
          expect(prisma.notification.update).not.toHaveBeenCalled();
          expect(gateway.emitNotificationStatusUpdate).not.toHaveBeenCalled();
        }
      },
    );

    it('looks the notification up by externalId', async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: 5,
        status: 'sent',
        traceId: 't',
      });
      await service.changeOutgoingStatus('ext-1', 'read', logger as never);
      expect(prisma.notification.findUnique).toHaveBeenCalledWith({
        where: { externalId: 'ext-1' },
        select: { status: true, id: true, traceId: true },
      });
    });

    it('ignores an unknown externalId without error', async () => {
      prisma.notification.findUnique.mockResolvedValue(null);
      await expect(
        service.changeOutgoingStatus('nope', 'read', logger as never),
      ).resolves.toBeUndefined();
      expect(prisma.notification.update).not.toHaveBeenCalled();
      expect(gateway.emitNotificationStatusUpdate).not.toHaveBeenCalled();
    });

    it('ignores an unknown Green-API status (priority -1)', async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: 5,
        status: 'pending',
        traceId: 't',
      });
      await service.changeOutgoingStatus('ext-1', 'weird', logger as never);
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });
  });

  describe('changeIncomingStatus (client reply confirms)', () => {
    const now = new Date('2026-12-20T12:00:00Z');

    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(now);
    });
    afterEach(() => jest.useRealTimers());

    it('confirms the latest notification of the phone within 48h', async () => {
      prisma.notification.findFirst.mockResolvedValue({
        id: 9,
        visitId: 3,
        traceId: 't',
      });

      await service.changeIncomingStatus('77071234567@c.us', logger as never);

      expect(prisma.notification.findFirst).toHaveBeenCalledWith({
        where: {
          createdAt: { gte: new Date('2026-12-18T12:00:00Z') },
          visit: { client: { phone: '+77071234567' } },
          status: { in: ['sent', 'delivered', 'read'], not: 'isConfirmed' },
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, visitId: true, traceId: true },
      });
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 9 },
        data: { status: 'isConfirmed' },
      });
      expect(gateway.emitNotificationStatusUpdate).toHaveBeenCalledWith(
        { notificationId: 9, status: 'isConfirmed' },
        'trace-1',
      );
    });

    it('does nothing when there is no eligible notification (older than 48h, already confirmed, failed)', async () => {
      prisma.notification.findFirst.mockResolvedValue(null);

      await service.changeIncomingStatus('77071234567@c.us', logger as never);

      expect(prisma.notification.update).not.toHaveBeenCalled();
      expect(gateway.emitNotificationStatusUpdate).not.toHaveBeenCalled();
    });

    it('confirms only the last notification (findFirst, createdAt desc)', async () => {
      prisma.notification.findFirst.mockResolvedValue({
        id: 2,
        visitId: 1,
        traceId: null,
      });
      await service.changeIncomingStatus('77071234567@c.us', logger as never);
      expect(prisma.notification.update).toHaveBeenCalledTimes(1);
      expect(prisma.notification.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });

    it('rethrows a DB error', async () => {
      prisma.notification.findFirst.mockRejectedValue(new Error('db down'));
      await expect(
        service.changeIncomingStatus('77071234567@c.us', logger as never),
      ).rejects.toThrow('db down');
    });
  });

  describe('handleInstanceStateChange', () => {
    it('writes status and timestamp to Redis for a first event', async () => {
      redis.get.mockResolvedValue(null);
      await service.handleInstanceStateChange(
        1101,
        'authorized',
        1000,
        logger as never,
      );
      expect(redis.set).toHaveBeenCalledWith(
        'whatsapp:instance:1101:status',
        'authorized',
      );
      expect(redis.set).toHaveBeenCalledWith(
        'whatsapp:instance:1101:last_ts',
        1000,
      );
    });

    it('applies an event with the same timestamp', async () => {
      redis.get.mockResolvedValue('1000');
      await service.handleInstanceStateChange(
        1101,
        'notAuthorized',
        1000,
        logger as never,
      );
      expect(redis.set).toHaveBeenCalledWith(
        'whatsapp:instance:1101:status',
        'notAuthorized',
      );
    });

    it('ignores an outdated event', async () => {
      redis.get.mockResolvedValue('2000');
      await service.handleInstanceStateChange(
        1101,
        'notAuthorized',
        1999,
        logger as never,
      );
      expect(redis.set).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalled();
    });

    it('rethrows a Redis error', async () => {
      redis.get.mockRejectedValue(new Error('redis down'));
      await expect(
        service.handleInstanceStateChange(
          1101,
          'authorized',
          1,
          logger as never,
        ),
      ).rejects.toThrow('redis down');
    });
  });

  describe('isInstanceAuthorized', () => {
    it('is true only for the "authorized" state', async () => {
      redis.get.mockResolvedValue('authorized');
      await expect(service.isInstanceAuthorized()).resolves.toBe(true);
      redis.get.mockResolvedValue('notAuthorized');
      await expect(service.isInstanceAuthorized()).resolves.toBe(false);
      redis.get.mockResolvedValue(null);
      await expect(service.isInstanceAuthorized()).resolves.toBe(false);
    });
  });

  describe('syncWhatsappStatus', () => {
    it('stores the state fetched from Green-API under the configured instance id', async () => {
      redis.get.mockResolvedValue(null);
      whatsapp.getStateInstance.mockResolvedValue('authorized');
      await service.syncWhatsappStatus();
      expect(redis.set).toHaveBeenCalledWith(
        'whatsapp:instance:1101:status',
        'authorized',
      );
    });
  });

  describe('processWhatsAppSending', () => {
    const notification = {
      id: 4,
      visit: {
        visitCode: '1234',
        startDateTime: new Date('2026-12-20T00:00:00Z'),
        endDateTime: new Date('2026-12-21T00:00:00Z'),
        issueTimeFrom: '10:00',
        issueTimeTo: '19:00',
        returnTimeUntil: '19:00',
        client: { name: 'Алия', phone: '+77071234567' },
        orders: [
          {
            rentPrice: 5000,
            prepaymentAmount: 1000,
            child: { name: 'Маша' },
            costume: { name: 'Эльза' },
          },
        ],
      },
    };

    beforeEach(() => {
      prisma.notification.count.mockResolvedValue(3);
    });

    it('marks the notification sent and stores externalId on success', async () => {
      prisma.notification.findUnique.mockResolvedValue(notification);
      whatsapp.sendMessage.mockResolvedValue('ext-77');

      await service.processWhatsAppSending(4, logger as never);

      expect(whatsapp.sendMessage).toHaveBeenCalledWith(
        '+77071234567',
        expect.stringContaining('*1234*'),
      );
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 4 },
        data: { status: 'sent', externalId: 'ext-77', errorText: null },
      });
      expect(gateway.emitNotificationStatusUpdate).toHaveBeenCalledWith(
        { notificationId: 4, status: 'sent', totalToday: 3 },
        'trace-1',
      );
    });

    it('marks failed with errorText, pushes it and rethrows when the provider fails', async () => {
      prisma.notification.findUnique.mockResolvedValue(notification);
      whatsapp.sendMessage.mockRejectedValue(new Error('instance blocked'));

      await expect(
        service.processWhatsAppSending(4, logger as never),
      ).rejects.toThrow('instance blocked');

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 4 },
        data: { status: 'failed', errorText: 'instance blocked' },
      });
      expect(gateway.emitNotificationStatusUpdate).toHaveBeenCalledWith(
        { notificationId: 4, status: 'failed', totalToday: 3 },
        'trace-1',
      );
    });

    it('throws UnrecoverableError (no retry) when the notification is missing', async () => {
      prisma.notification.findUnique.mockResolvedValue(null);
      await expect(
        service.processWhatsAppSending(4, logger as never),
      ).rejects.toBeInstanceOf(UnrecoverableError);
      expect(whatsapp.sendMessage).not.toHaveBeenCalled();
    });

    it('throws UnrecoverableError when the visit is gone', async () => {
      prisma.notification.findUnique.mockResolvedValue({ id: 4, visit: null });
      await expect(
        service.processWhatsAppSending(4, logger as never),
      ).rejects.toBeInstanceOf(UnrecoverableError);
    });

    it.todo(
      'sets noAccount when the number has no WhatsApp (the status is not produced anywhere yet, T-053)',
    );
  });

  describe('handleManualResend', () => {
    it('resets the notification to pending and re-enqueues the job with the same jobId', async () => {
      prisma.notification.findUnique.mockResolvedValue({ id: 4 });
      const remove = jest.fn();
      queue.getJob.mockResolvedValue({ remove });

      const result = await service.handleManualResend(4, logger as never);

      expect(queue.getJob).toHaveBeenCalledWith('notification-4');
      expect(remove).toHaveBeenCalled();
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 4 },
        data: { status: 'pending', errorText: null, traceId: 'trace-1' },
      });
      expect(queue.add).toHaveBeenCalledWith(
        'send-whatsapp',
        { notificationId: 4, traceId: 'trace-1' },
        { jobId: 'notification-4' },
      );
      expect(result).toEqual({ success: true });
    });

    it('works when there is no old job in the queue', async () => {
      prisma.notification.findUnique.mockResolvedValue({ id: 4 });
      queue.getJob.mockResolvedValue(undefined);
      await service.handleManualResend(4, logger as never);
      expect(queue.add).toHaveBeenCalled();
    });

    it('fails for an unknown notification without touching the queue', async () => {
      prisma.notification.findUnique.mockResolvedValue(null);
      await expect(
        service.handleManualResend(4, logger as never),
      ).rejects.toThrow('Notification 4 not found');
      expect(queue.add).not.toHaveBeenCalled();
    });
  });

  describe('handleUpdatePhoneAndResend', () => {
    it('updates the client phone and notification in one transaction, then re-enqueues', async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: 4,
        visit: { clientId: 7 },
      });
      queue.getJob.mockResolvedValue(undefined);

      await service.handleUpdatePhoneAndResend(
        4,
        '+77070000000',
        logger as never,
      );

      expect(tx.client.update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { phone: '+77070000000' },
      });
      expect(tx.notification.update).toHaveBeenCalledWith({
        where: { id: 4 },
        data: { status: 'pending', errorText: null, traceId: 'trace-1' },
      });
      expect(queue.add).toHaveBeenCalledWith(
        'send-whatsapp',
        { notificationId: 4, traceId: 'trace-1' },
        { jobId: 'notification-4' },
      );
    });

    it('fails and enqueues nothing when the visit is missing', async () => {
      prisma.notification.findUnique.mockResolvedValue({ id: 4, visit: null });
      await expect(
        service.handleUpdatePhoneAndResend(4, '+7', logger as never),
      ).rejects.toThrow('Notification or related visit not found');
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(queue.add).not.toHaveBeenCalled();
    });
  });

  describe('getContextualLogger', () => {
    it('takes traceId of the notification found by externalId for status webhooks', async () => {
      prisma.notification.findUnique.mockResolvedValue({ traceId: 'abc' });
      const req: Record<string, unknown> = {};
      await service.getContextualLogger(
        { typeWebhook: 'outgoingMessageStatus', idMessage: 'ext-1' } as never,
        req,
      );
      expect(prisma.notification.findUnique).toHaveBeenCalledWith({
        where: { externalId: 'ext-1' },
        select: { traceId: true },
      });
      expect(req['traceId']).toBe('abc');
      expect(logger.child).toHaveBeenCalledWith({
        traceId: 'abc',
        webhookType: 'outgoingMessageStatus',
      });
    });
  });
});

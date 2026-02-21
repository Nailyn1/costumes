import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { NotificationService } from './notification.service';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@Processor('notifications')
export class NotificationProcessor extends WorkerHost {
  constructor(
    private readonly notificationService: NotificationService,
    @InjectPinoLogger(NotificationProcessor.name)
    private readonly logger: PinoLogger,
  ) {
    super();
  }

  async process(
    job: Job<{ notificationId: number; traceId: string }, any, string>,
  ): Promise<any> {
    const { traceId, notificationId } = job.data;

    const childLogger = this.logger.logger.child({
      traceId,
      jobId: job.id,
      context: NotificationProcessor.name,
    });

    const isReady = await this.notificationService.isInstanceAuthorized();
    childLogger.info(
      { jobId: job.id, jobName: job.name, notificationId },
      'Processing job',
    );

    if (!isReady) {
      childLogger.warn(
        { jobId: job.id },
        'Job postponed: WhatsApp instance is not authorized',
      );
      throw new Error('WhatsApp API not authorized');
    }

    try {
      switch (job.name) {
        case 'send-whatsapp':
          return await this.notificationService.processWhatsAppSending(
            notificationId,
            childLogger,
          );

        default:
          childLogger.warn({ jobName: job.name }, 'Unknown job name');
          break;
      }
    } catch (error) {
      childLogger.error(error, 'Failed to process notification job');
      throw error;
    }
  }
}

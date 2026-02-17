import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { NotificationService } from './notification.service';
import { Logger } from '@nestjs/common';

@Processor('notifications')
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(private readonly notificationService: NotificationService) {
    super();
  }

  async process(
    job: Job<{ notificationId: number }, any, string>,
  ): Promise<any> {
    const isReady = await this.notificationService.isInstanceAuthorized();

    this.logger.log(`Processing job ${job.id} of type ${job.name}...`);
    if (!isReady) {
      this.logger.warn(
        `Job ${job.id} postponed: WhatsApp instance is not authorized.`,
      );
      throw new Error('WhatsApp API not authorized');
    }

    switch (job.name) {
      case 'send-whatsapp':
        return await this.notificationService.processWhatsAppSending(
          job.data.notificationId,
        );

      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
        break;
    }
  }
}

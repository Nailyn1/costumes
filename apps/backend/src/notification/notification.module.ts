import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { QueueModule } from '../redis/queue.module';
import { BullModule } from '@nestjs/bullmq';
import { WhatsappProvider } from './whatsapp.provider';
import { NotificationProcessor } from './notification.processor';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    HttpModule,
    QueueModule,
    BullModule.registerQueue({
      name: 'notifications',
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 1000,
        attempts: 10,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    }),
  ],
  controllers: [NotificationController],
  providers: [NotificationService, WhatsappProvider, NotificationProcessor],
  exports: [BullModule],
})
export class NotificationModule {}

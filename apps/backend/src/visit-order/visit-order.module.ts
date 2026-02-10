import { Module } from '@nestjs/common';
import { VisitOrderService } from './visit-order.sevice';
import { VisitController } from './visits.controller';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [AuthModule, NotificationModule],
  controllers: [VisitController],
  providers: [VisitOrderService],
})
export class VisitOrderModule {}

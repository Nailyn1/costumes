import { Module } from '@nestjs/common';
import { VisitOrderService } from './visit-order.service';
import { VisitController } from './visits.controller';
import { VisitReadController } from './visit-read.controller';
import { VisitReadService } from './visit-read.service';
import { AuthModule } from '../auth/auth.module';
import { CostumePhotosModule } from '../costume-photos/costume-photos.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [AuthModule, NotificationModule, CostumePhotosModule],
  controllers: [VisitController, VisitReadController],
  providers: [VisitOrderService, VisitReadService],
})
export class VisitOrderModule {}

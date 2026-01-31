import { Module } from '@nestjs/common';
import { VisitOrderService } from './visit-order.service';
import { VisitController } from './visits.controller';

@Module({
  controllers: [VisitController],
  providers: [VisitOrderService],
})
export class VisitOrderModule {}

import { Module } from '@nestjs/common';
import { CostumesService } from './costumes.service';
import { CostumesController } from './costumes.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [CostumesController],
  providers: [CostumesService],
})
export class CostumesModule {}

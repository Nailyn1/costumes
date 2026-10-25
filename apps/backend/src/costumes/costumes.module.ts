import { Module } from '@nestjs/common';
import { CostumesService } from './costumes.service';
import { CostumesController } from './costumes.controller';
import { CostumeCategoriesService } from './costume-categories.service';
import { CostumeCategoriesController } from './costume-categories.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [CostumesController, CostumeCategoriesController],
  providers: [CostumesService, CostumeCategoriesService],
})
export class CostumesModule {}

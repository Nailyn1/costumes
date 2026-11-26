import { Module } from '@nestjs/common';
import { CostumesService } from './costumes.service';
import { CostumesController } from './costumes.controller';
import { CostumesRepository } from './costumes.repository';
import { AuthModule } from '../auth/auth.module';
import { CostumePhotosModule } from '../costume-photos/costume-photos.module';

@Module({
  imports: [AuthModule, CostumePhotosModule],
  controllers: [CostumesController],
  providers: [CostumesService, CostumesRepository],
})
export class CostumesModule {}

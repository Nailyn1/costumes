import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CostumePhotosController } from './costume-photos.controller';
import { CostumePhotosService } from './costume-photos.service';

@Module({
  imports: [AuthModule],
  controllers: [CostumePhotosController],
  providers: [CostumePhotosService],
  exports: [CostumePhotosService],
})
export class CostumePhotosModule {}

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { CostumePhotoDto } from '@costumes/shared';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { RequestWithUser } from '../auth/active-user.interface';
import {
  CostumePhotosService,
  MAX_IMAGE_BYTES,
  UploadedImage,
} from './costume-photos.service';
import {
  ReorderCostumePhotosRequest,
  UploadCostumePhotoFields,
} from './dto/costume-photos.dto';

@Controller('costumes/:costumeId/photos')
export class CostumePhotosController {
  constructor(private readonly photos: CostumePhotosService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'image', maxCount: 1 },
        { name: 'thumb', maxCount: 1 },
      ],
      // файлы в памяти: оба сжаты в браузере; точные лимиты — в сервисе
      { limits: { fileSize: MAX_IMAGE_BYTES, files: 2, fields: 4 } },
    ),
  )
  async upload(
    @Param('costumeId', ParseIntPipe) costumeId: number,
    @UploadedFiles()
    files: { image?: UploadedImage[]; thumb?: UploadedImage[] } | undefined,
    @Body() fields: UploadCostumePhotoFields,
    @Req() req: RequestWithUser,
  ): Promise<CostumePhotoDto> {
    const userId = Number(req.user.id);
    return this.photos.upload(
      costumeId,
      files?.image?.[0],
      files?.thumb?.[0],
      fields,
      Number.isSafeInteger(userId) && userId > 0 ? userId : null,
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  list(
    @Param('costumeId', ParseIntPipe) costumeId: number,
  ): Promise<CostumePhotoDto[]> {
    return this.photos.list(costumeId);
  }

  // статический путь — до `:photoId`
  @Patch('order')
  @UseGuards(JwtAuthGuard)
  reorder(
    @Param('costumeId', ParseIntPipe) costumeId: number,
    @Body() dto: ReorderCostumePhotosRequest,
  ): Promise<CostumePhotoDto[]> {
    return this.photos.reorder(costumeId, dto.photoIds);
  }

  @Delete(':photoId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('costumeId', ParseIntPipe) costumeId: number,
    @Param('photoId', ParseIntPipe) photoId: number,
  ): Promise<void> {
    await this.photos.remove(costumeId, photoId);
  }
}

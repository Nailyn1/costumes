import { randomUUID } from 'node:crypto';
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CostumePhotoDto } from '@costumes/shared';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../prisma/generated/client';
import { S3StorageService } from '../storage/s3-storage.service';
import {
  IMAGE_EXTENSION,
  IMAGE_MIME,
  detectImageKind,
} from './image-signature';

export const MAX_PHOTOS_PER_COSTUME = 15;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_THUMB_BYTES = 200 * 1024;

export interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

export interface PhotoSummary {
  coverThumbUrl?: string;
  photoCount: number;
}

@Injectable()
export class CostumePhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3StorageService,
    @InjectPinoLogger(CostumePhotosService.name)
    private readonly logger: PinoLogger,
  ) {}

  private toDto(photo: {
    id: number;
    key: string;
    thumbKey: string;
    width: number;
    height: number;
  }): CostumePhotoDto {
    return {
      id: photo.id,
      url: this.s3.getPublicUrl(photo.key),
      thumbUrl: this.s3.getPublicUrl(photo.thumbKey),
      width: photo.width,
      height: photo.height,
    };
  }

  private async assertCostumeExists(costumeId: number): Promise<void> {
    const costume = await this.prisma.costume.findFirst({
      where: { id: costumeId, deletedAt: null },
      select: { id: true },
    });
    if (!costume) {
      throw new NotFoundException(`Костюм с ID ${costumeId} не найден`);
    }
  }

  /** Блокирует строку костюма: параллельные загрузки и перестановки идут по очереди. */
  private async lockCostume(
    tx: Prisma.TransactionClient,
    costumeId: number,
  ): Promise<void> {
    const rows = await tx.$queryRaw<{ id: number }[]>`
      SELECT id FROM costumes WHERE id = ${costumeId} AND deleted_at IS NULL FOR UPDATE`;
    if (rows.length === 0) {
      throw new NotFoundException(`Костюм с ID ${costumeId} не найден`);
    }
  }

  private validateFile(
    file: UploadedImage | undefined,
    field: 'image' | 'thumb',
    maxBytes: number,
  ) {
    const label = field === 'image' ? 'Фото' : 'Превью';
    if (!file) {
      throw new BadRequestException(`${label} не передано (поле «${field}»)`);
    }
    if (file.size > maxBytes) {
      throw new BadRequestException(
        `${label} слишком большое: не более ${Math.round(maxBytes / 1024)} КБ`,
      );
    }
    const kind = detectImageKind(file.buffer);
    if (
      !kind ||
      (file.mimetype !== IMAGE_MIME.jpeg && file.mimetype !== IMAGE_MIME.webp)
    ) {
      throw new BadRequestException(
        `${label}: допустимы только изображения JPEG и WebP`,
      );
    }
    if (file.mimetype !== IMAGE_MIME[kind]) {
      throw new BadRequestException(
        `${label}: содержимое файла не соответствует его типу`,
      );
    }
    return kind;
  }

  private limitReached(): ConflictException {
    return new ConflictException(
      `У костюма уже ${MAX_PHOTOS_PER_COSTUME} фото — это максимум. Удалите лишние`,
    );
  }

  async upload(
    costumeId: number,
    image: UploadedImage | undefined,
    thumb: UploadedImage | undefined,
    size: { width: number; height: number },
    userId: number | null,
  ): Promise<CostumePhotoDto> {
    this.s3.assertConfigured();
    const imageKind = this.validateFile(image, 'image', MAX_IMAGE_BYTES);
    const thumbKind = this.validateFile(thumb, 'thumb', MAX_THUMB_BYTES);
    if (!image || !thumb) throw new BadRequestException('Файлы не переданы');

    await this.assertCostumeExists(costumeId);
    const existing = await this.prisma.costumePhoto.count({
      where: { costumeId, deletedAt: null },
    });
    if (existing >= MAX_PHOTOS_PER_COSTUME) {
      throw this.limitReached();
    }

    const id = randomUUID();
    const key = `costumes/${costumeId}/${id}.${IMAGE_EXTENSION[imageKind]}`;
    const thumbKey = `costumes/${costumeId}/${id}_thumb.${IMAGE_EXTENSION[thumbKind]}`;

    try {
      await this.s3.putObject({
        key,
        body: image.buffer,
        contentType: IMAGE_MIME[imageKind],
      });
      await this.s3.putObject({
        key: thumbKey,
        body: thumb.buffer,
        contentType: IMAGE_MIME[thumbKind],
      });
    } catch (error) {
      this.logger.error({ err: error, costumeId }, 'Photo upload to S3 failed');
      await this.removeObjects([key, thumbKey]);
      throw new BadGatewayException(
        'Не удалось сохранить фото в хранилище. Попробуйте ещё раз',
      );
    }

    try {
      const photo = await this.prisma.$transaction(async (tx) => {
        await this.lockCostume(tx, costumeId);
        const active = await tx.costumePhoto.findMany({
          where: { costumeId, deletedAt: null },
          select: { sortOrder: true },
        });
        if (active.length >= MAX_PHOTOS_PER_COSTUME) {
          throw this.limitReached();
        }
        const sortOrder =
          active.reduce((max, p) => Math.max(max, p.sortOrder), -1) + 1;
        return tx.costumePhoto.create({
          data: {
            costumeId,
            key,
            thumbKey,
            width: size.width,
            height: size.height,
            sizeBytes: image.size + thumb.size,
            sortOrder,
            createdByUserId: userId,
          },
        });
      });
      return this.toDto(photo);
    } catch (error) {
      // запись в БД не состоялась — файлы в бакете осиротели
      await this.removeObjects([key, thumbKey]);
      throw error;
    }
  }

  async list(costumeId: number): Promise<CostumePhotoDto[]> {
    await this.assertCostumeExists(costumeId);
    const photos = await this.prisma.costumePhoto.findMany({
      where: { costumeId, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    return photos.map((photo) => this.toDto(photo));
  }

  async remove(costumeId: number, photoId: number): Promise<void> {
    const photo = await this.prisma.costumePhoto.findFirst({
      where: { id: photoId, costumeId, deletedAt: null },
    });
    if (!photo) {
      throw new NotFoundException(`Фото с ID ${photoId} не найдено`);
    }
    // deletedAt: null в условии защищает от двойного удаления в гонке
    const { count } = await this.prisma.costumePhoto.updateMany({
      where: { id: photoId, costumeId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (count === 0) {
      throw new NotFoundException(`Фото с ID ${photoId} не найдено`);
    }
    await this.removeObjects([photo.key, photo.thumbKey]);
  }

  async reorder(
    costumeId: number,
    photoIds: number[],
  ): Promise<CostumePhotoDto[]> {
    if (new Set(photoIds).size !== photoIds.length) {
      throw new BadRequestException('В списке фото есть повторы');
    }
    return this.prisma.$transaction(async (tx) => {
      await this.lockCostume(tx, costumeId);
      const active = await tx.costumePhoto.findMany({
        where: { costumeId, deletedAt: null },
      });
      const byId = new Map(active.map((photo) => [photo.id, photo]));
      if (
        byId.size !== photoIds.length ||
        photoIds.some((id) => !byId.has(id))
      ) {
        throw new BadRequestException(
          'Список должен содержать все фото костюма: обновите страницу и повторите',
        );
      }
      for (const [index, id] of photoIds.entries()) {
        await tx.costumePhoto.update({
          where: { id },
          data: { sortOrder: index },
        });
      }
      return photoIds.map((id) => this.toDto(byId.get(id)!));
    });
  }

  /** Обложка и число фото для набора костюмов — одним запросом. */
  async summaries(costumeIds: number[]): Promise<Map<number, PhotoSummary>> {
    const result = new Map<number, PhotoSummary>();
    const ids = [...new Set(costumeIds)];
    if (ids.length === 0) return result;
    const photos = await this.prisma.costumePhoto.findMany({
      where: { costumeId: { in: ids }, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: { costumeId: true, thumbKey: true },
    });
    for (const photo of photos) {
      const current = result.get(photo.costumeId);
      if (current) {
        current.photoCount += 1;
      } else {
        result.set(photo.costumeId, {
          coverThumbUrl: this.s3.getPublicUrl(photo.thumbKey),
          photoCount: 1,
        });
      }
    }
    return result;
  }

  /** Удаление из S3 вторично: ошибка только логируется, в бакете остаётся лишний файл. */
  private async removeObjects(keys: string[]): Promise<void> {
    for (const key of keys) {
      try {
        await this.s3.deleteObject(key);
      } catch (error) {
        this.logger.warn({ err: error, key }, 'Failed to delete S3 object');
      }
    }
  }
}

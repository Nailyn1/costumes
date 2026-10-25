import {
  ReorderCostumePhotosRequestSchema,
  UploadCostumePhotoFieldsSchema,
} from '@costumes/shared';
import { createZodDto } from '../../common/zod-dto';

export class ReorderCostumePhotosRequest extends createZodDto(
  ReorderCostumePhotosRequestSchema,
) {}
export class UploadCostumePhotoFields extends createZodDto(
  UploadCostumePhotoFieldsSchema,
) {}

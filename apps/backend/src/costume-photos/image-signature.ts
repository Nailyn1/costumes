export type ImageKind = 'jpeg' | 'webp';

export const IMAGE_MIME: Record<ImageKind, string> = {
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

export const IMAGE_EXTENSION: Record<ImageKind, string> = {
  jpeg: 'jpg',
  webp: 'webp',
};

/**
 * Тип изображения по первым байтам файла (magic bytes), а не по mime/имени,
 * которые присылает клиент. Допустимы только JPEG и WebP.
 */
export function detectImageKind(buffer: Buffer): ImageKind | null {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'jpeg';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

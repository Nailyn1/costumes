import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  CostumePhotosService,
  MAX_IMAGE_BYTES,
  MAX_PHOTOS_PER_COSTUME,
  MAX_THUMB_BYTES,
  UploadedImage,
} from './costume-photos.service';
import { detectImageKind } from './image-signature';
import { createPrismaMock } from '../test-utils';

const { prisma, tx, reset } = createPrismaMock();

const s3 = {
  assertConfigured: jest.fn(),
  putObject: jest.fn(),
  deleteObject: jest.fn(),
  getPublicUrl: (key: string) => `https://cdn.test/${key}`,
};
const logger = { warn: jest.fn(), error: jest.fn() };

const service = () =>
  new CostumePhotosService(prisma as never, s3 as never, logger as never);

const jpegBytes = (size = 1024) =>
  Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(size)]);
const webpBytes = () =>
  Buffer.concat([
    Buffer.from('RIFF', 'ascii'),
    Buffer.alloc(4),
    Buffer.from('WEBP', 'ascii'),
    Buffer.alloc(16),
  ]);
const file = (
  buffer: Buffer,
  mimetype = 'image/jpeg',
  size = buffer.length,
): UploadedImage => ({ buffer, mimetype, size });

const dimensions = { width: 1600, height: 1200 };

describe('detectImageKind', () => {
  it('recognises jpeg and webp by signature only', () => {
    expect(detectImageKind(jpegBytes())).toBe('jpeg');
    expect(detectImageKind(webpBytes())).toBe('webp');
  });

  it('rejects png, gif, text and too short buffers', () => {
    expect(
      detectImageKind(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a])),
    ).toBeNull();
    expect(detectImageKind(Buffer.from('GIF89a......'))).toBeNull();
    expect(detectImageKind(Buffer.from('<svg></svg>'))).toBeNull();
    expect(detectImageKind(Buffer.from([0xff, 0xd8]))).toBeNull();
  });
});

describe('CostumePhotosService', () => {
  beforeEach(() => {
    reset();
    jest.clearAllMocks();
    s3.putObject.mockResolvedValue(undefined);
    s3.deleteObject.mockResolvedValue(undefined);
    prisma.costume.findFirst.mockResolvedValue({ id: 7 });
    prisma.costumePhoto.count.mockResolvedValue(0);
    // FOR UPDATE — сырой SQL, в unit-тесте с Prisma-моком его не выполнить
    jest
      .spyOn(CostumePhotosService.prototype as never, 'lockCostume')
      .mockResolvedValue(undefined as never);
    tx.costumePhoto.findMany.mockResolvedValue([]);
    tx.costumePhoto.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 100, ...data }),
    );
  });

  describe('upload', () => {
    it('stores both files in S3 and returns public urls', async () => {
      const result = await service().upload(
        7,
        file(jpegBytes()),
        file(jpegBytes(64)),
        dimensions,
        3,
      );

      expect(s3.putObject).toHaveBeenCalledTimes(2);
      const [first, second] = (
        s3.putObject.mock.calls as [{ key: string; contentType: string }][]
      ).map(([params]) => params);
      expect(first.key).toMatch(/^costumes\/7\/[0-9a-f-]{36}\.jpg$/);
      expect(second.key).toMatch(/^costumes\/7\/[0-9a-f-]{36}_thumb\.jpg$/);
      expect(first.contentType).toBe('image/jpeg');
      expect(result).toEqual({
        id: 100,
        url: `https://cdn.test/${first.key}`,
        thumbUrl: `https://cdn.test/${second.key}`,
        width: 1600,
        height: 1200,
      });
      expect(tx.costumePhoto.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          costumeId: 7,
          sortOrder: 0,
          createdByUserId: 3,
          width: 1600,
        }) as unknown,
      });
    });

    it('appends the photo after the last sort order', async () => {
      tx.costumePhoto.findMany.mockResolvedValue([
        { sortOrder: 0 },
        { sortOrder: 4 },
      ]);
      await service().upload(
        7,
        file(jpegBytes()),
        file(jpegBytes(8)),
        dimensions,
        null,
      );
      expect(tx.costumePhoto.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sortOrder: 5,
          createdByUserId: null,
        }) as unknown,
      });
    });

    it('accepts webp and keeps the webp extension', async () => {
      await service().upload(
        7,
        file(webpBytes(), 'image/webp'),
        file(webpBytes(), 'image/webp'),
        dimensions,
        1,
      );
      const key = (s3.putObject.mock.calls as [{ key: string }][])[0][0].key;
      expect(key).toMatch(/\.webp$/);
    });

    it('rejects a client that is not configured before touching files', async () => {
      s3.assertConfigured.mockImplementationOnce(() => {
        throw new ServiceUnavailableException('Хранилище фото не настроено');
      });
      await expect(
        service().upload(
          7,
          file(jpegBytes()),
          file(jpegBytes(8)),
          dimensions,
          1,
        ),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(s3.putObject).not.toHaveBeenCalled();
    });

    it.each([
      [
        'image/png',
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]),
      ],
      ['image/jpeg', Buffer.from('<?php echo 1; ?> not an image at all')],
      ['text/html', jpegBytes()],
    ])('rejects mime %s with a mismatching signature', async (mime, bytes) => {
      await expect(
        service().upload(
          7,
          file(bytes, mime),
          file(jpegBytes(8)),
          dimensions,
          1,
        ),
      ).rejects.toThrow('допустимы только изображения JPEG и WebP');
      expect(s3.putObject).not.toHaveBeenCalled();
    });

    it('rejects a webp body declared as jpeg', async () => {
      await expect(
        service().upload(
          7,
          file(webpBytes(), 'image/jpeg'),
          file(jpegBytes(8)),
          dimensions,
          1,
        ),
      ).rejects.toThrow('не соответствует его типу');
    });

    it('rejects an oversized image and an oversized thumb', async () => {
      await expect(
        service().upload(
          7,
          file(jpegBytes(), 'image/jpeg', MAX_IMAGE_BYTES + 1),
          file(jpegBytes(8)),
          dimensions,
          1,
        ),
      ).rejects.toThrow('Фото слишком большое');
      await expect(
        service().upload(
          7,
          file(jpegBytes()),
          file(jpegBytes(8), 'image/jpeg', MAX_THUMB_BYTES + 1),
          dimensions,
          1,
        ),
      ).rejects.toThrow('Превью слишком большое');
      expect(s3.putObject).not.toHaveBeenCalled();
    });

    it('rejects a request without the thumb', async () => {
      await expect(
        service().upload(7, file(jpegBytes()), undefined, dimensions, 1),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('does not find a deleted costume', async () => {
      prisma.costume.findFirst.mockResolvedValue(null);
      await expect(
        service().upload(
          7,
          file(jpegBytes()),
          file(jpegBytes(8)),
          dimensions,
          1,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.costume.findFirst).toHaveBeenCalledWith({
        where: { id: 7, deletedAt: null },
        select: { id: true },
      });
      expect(s3.putObject).not.toHaveBeenCalled();
    });

    it('answers 409 when the costume already has the maximum of photos', async () => {
      prisma.costumePhoto.count.mockResolvedValue(MAX_PHOTOS_PER_COSTUME);
      await expect(
        service().upload(
          7,
          file(jpegBytes()),
          file(jpegBytes(8)),
          dimensions,
          1,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.costumePhoto.count).toHaveBeenCalledWith({
        where: { costumeId: 7, deletedAt: null },
      });
      expect(s3.putObject).not.toHaveBeenCalled();
    });

    it('removes the uploaded objects when a parallel upload took the last slot', async () => {
      tx.costumePhoto.findMany.mockResolvedValue(
        Array.from({ length: MAX_PHOTOS_PER_COSTUME }, (_, i) => ({
          sortOrder: i,
        })),
      );
      await expect(
        service().upload(
          7,
          file(jpegBytes()),
          file(jpegBytes(8)),
          dimensions,
          1,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(tx.costumePhoto.create).not.toHaveBeenCalled();
      expect(s3.deleteObject).toHaveBeenCalledTimes(2);
    });

    it('cleans up and answers 502 when S3 rejects the second file', async () => {
      s3.putObject
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('boom'));
      await expect(
        service().upload(
          7,
          file(jpegBytes()),
          file(jpegBytes(8)),
          dimensions,
          1,
        ),
      ).rejects.toBeInstanceOf(BadGatewayException);
      expect(s3.deleteObject).toHaveBeenCalledTimes(2);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    const photo = {
      id: 5,
      key: 'costumes/7/a.jpg',
      thumbKey: 'costumes/7/a_thumb.jpg',
    };

    it('soft deletes the photo and then deletes both S3 objects', async () => {
      prisma.costumePhoto.findFirst.mockResolvedValue(photo);
      prisma.costumePhoto.updateMany.mockResolvedValue({ count: 1 });

      await service().remove(7, 5);

      expect(prisma.costumePhoto.updateMany).toHaveBeenCalledWith({
        where: { id: 5, costumeId: 7, deletedAt: null },
        data: { deletedAt: expect.any(Date) as unknown },
      });
      expect(
        (s3.deleteObject.mock.calls as [string][]).map(([key]) => key),
      ).toEqual([photo.key, photo.thumbKey]);
      expect(
        prisma.costumePhoto.updateMany.mock.invocationCallOrder[0],
      ).toBeLessThan(s3.deleteObject.mock.invocationCallOrder[0]);
    });

    it('only logs when S3 deletion fails', async () => {
      prisma.costumePhoto.findFirst.mockResolvedValue(photo);
      prisma.costumePhoto.updateMany.mockResolvedValue({ count: 1 });
      s3.deleteObject.mockRejectedValue(new Error('s3 down'));

      await expect(service().remove(7, 5)).resolves.toBeUndefined();
      expect(logger.warn).toHaveBeenCalledTimes(2);
    });

    it('answers 404 for an already deleted or foreign photo', async () => {
      prisma.costumePhoto.findFirst.mockResolvedValue(null);
      await expect(service().remove(7, 5)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.costumePhoto.findFirst).toHaveBeenCalledWith({
        where: { id: 5, costumeId: 7, deletedAt: null },
      });
      expect(s3.deleteObject).not.toHaveBeenCalled();
    });

    it('answers 404 when a parallel request deleted the photo first', async () => {
      prisma.costumePhoto.findFirst.mockResolvedValue(photo);
      prisma.costumePhoto.updateMany.mockResolvedValue({ count: 0 });
      await expect(service().remove(7, 5)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(s3.deleteObject).not.toHaveBeenCalled();
    });
  });

  describe('reorder', () => {
    const active = [1, 2, 3].map((id) => ({
      id,
      key: `costumes/7/${id}.jpg`,
      thumbKey: `costumes/7/${id}_thumb.jpg`,
      width: 100,
      height: 100,
    }));

    it('assigns sort order by position and returns the new order', async () => {
      tx.costumePhoto.findMany.mockResolvedValue(active);
      tx.costumePhoto.update.mockResolvedValue({});

      const result = await service().reorder(7, [3, 1, 2]);

      expect(result.map((p) => p.id)).toEqual([3, 1, 2]);
      expect(tx.costumePhoto.update.mock.calls).toEqual([
        [{ where: { id: 3 }, data: { sortOrder: 0 } }],
        [{ where: { id: 1 }, data: { sortOrder: 1 } }],
        [{ where: { id: 2 }, data: { sortOrder: 2 } }],
      ]);
    });

    it('requires exactly the active photos of the costume', async () => {
      tx.costumePhoto.findMany.mockResolvedValue(active);
      await expect(service().reorder(7, [1, 2])).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service().reorder(7, [1, 2, 99])).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(tx.costumePhoto.findMany).toHaveBeenCalledWith({
        where: { costumeId: 7, deletedAt: null },
      });
      expect(tx.costumePhoto.update).not.toHaveBeenCalled();
    });

    it('rejects duplicated ids', async () => {
      await expect(service().reorder(7, [1, 1, 2])).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('list and summaries', () => {
    it('lists active photos ordered by sort order', async () => {
      prisma.costumePhoto.findMany.mockResolvedValue([
        { id: 2, key: 'k2', thumbKey: 't2', width: 10, height: 20 },
      ]);
      await expect(service().list(7)).resolves.toEqual([
        {
          id: 2,
          url: 'https://cdn.test/k2',
          thumbUrl: 'https://cdn.test/t2',
          width: 10,
          height: 20,
        },
      ]);
      expect(prisma.costumePhoto.findMany).toHaveBeenCalledWith({
        where: { costumeId: 7, deletedAt: null },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      });
    });

    it('builds cover and count per costume with one query', async () => {
      prisma.costumePhoto.findMany.mockResolvedValue([
        { costumeId: 1, thumbKey: 'a_thumb' },
        { costumeId: 2, thumbKey: 'b_thumb' },
        { costumeId: 1, thumbKey: 'c_thumb' },
      ]);
      const result = await service().summaries([1, 2, 3, 1]);

      expect(prisma.costumePhoto.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.costumePhoto.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { costumeId: { in: [1, 2, 3] }, deletedAt: null },
        }),
      );
      expect(result.get(1)).toEqual({
        coverThumbUrl: 'https://cdn.test/a_thumb',
        photoCount: 2,
      });
      expect(result.get(2)).toEqual({
        coverThumbUrl: 'https://cdn.test/b_thumb',
        photoCount: 1,
      });
      expect(result.has(3)).toBe(false);
    });

    it('does not query for an empty id list', async () => {
      await expect(service().summaries([])).resolves.toEqual(new Map());
      expect(prisma.costumePhoto.findMany).not.toHaveBeenCalled();
    });
  });
});

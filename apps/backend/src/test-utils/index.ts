export * from './prisma-mock';
export * from './factories';

/** Заглушка CostumePhotosService: у костюмов нет фото. */
export const noPhotos = {
  summaries: () => Promise.resolve(new Map()),
};

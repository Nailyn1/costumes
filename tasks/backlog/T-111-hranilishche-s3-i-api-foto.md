# T-111 · Хранилище S3 и API фото костюмов (backend + infra)

- **Приоритет:** high
- **Область:** Фичи / Инфраструктура
- **Создана:** 2026-10-25
- **Эпик:** [T-032](./T-032-kategorii-i-foto-kostyumov.md)

## Контекст

Хранилище — S3 PS Cloud, как в secmarket: образец `C:\JavaScript\secmarket\apps\api\src\infrastructure\s3\s3-storage.service.ts` (`@aws-sdk/client-s3`, публичный бакет, `Cache-Control: public, max-age=31536000, immutable`, `requestChecksumCalculation: "WHEN_REQUIRED"`, публичный URL через `S3_PUBLIC_BASE_URL`). Загрузка **через бэкенд**: прямую загрузку из браузера защита провайдера не пропускала. Фото заранее сжимает браузер (T-112), поэтому запрос небольшой.

## Что сделать

1. **S3-модуль** `apps/backend/src/storage/` (или `infrastructure/s3`): перенести сервис из secmarket (`putObject`, `deleteObject`, `getPublicUrl`), конфиг через `ConfigService`, понятная ошибка, если S3 не настроен. Env-имена — как в secmarket: `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET_PUBLIC`, `S3_PUBLIC_BASE_URL`, `S3_FORCE_PATH_STYLE` — в `.env.example` с пустыми значениями, в `.agents/setup.md` §2.
2. **Prisma**: `CostumePhoto` (`id`, `costumeId`, `key`, `thumbKey`, `width`, `height`, `sizeBytes`, `sortOrder`, `createdAt`, `createdByUserId?`, `deletedAt`); индекс `(costumeId, deletedAt, sortOrder)`.
3. **API (TypeSpec → shared)**:
   - `POST /costumes/{costumeId}/photos` — `multipart/form-data`: `image` (≤ 2 МБ) + `thumb` (≤ 200 КБ), только `image/jpeg`/`image/webp`; проверка сигнатуры файла (magic bytes), а не только mime; лимит **15 фото** на костюм → 409;
   - `GET /costumes/{costumeId}/photos` → `[{ id, url, thumbUrl, width, height }]` по `sortOrder`;
   - `DELETE /costumes/{costumeId}/photos/{photoId}` — soft delete; объект в S3 удаляется после коммита (ошибка удаления в S3 только логируется);
   - `PATCH /costumes/{costumeId}/photos/order` — порядок (первое = обложка);
   - в ответах выбора/поиска/списка костюма и в заказах выдачи/возврата/бирок — `coverThumbUrl?` и `photoCount` (без полного списка — экономия трафика).
   Ключи: `costumes/{costumeId}/{uuid}.jpg` и `..._thumb.jpg`, uuid генерирует сервер.
4. **Infra**: `client_max_body_size 6m;` для `location /api/` в `apps/crm-frontend/nginx.conf`; лимиты multer на бэкенде; `.dockerignore`/Docker без изменений, если не требуется.
5. **Тесты**: unit сервиса фото с моком S3 (лимит, порядок, soft delete, отказ по mime/сигнатуре, удаление из S3 после коммита); integration с моком `S3StorageService` (как `WhatsappProvider` в `test-app.ts`) — загрузка → список → удаление. В тестах реальный S3 не используется.

## Критерии готовности

- [ ] S3-модуль и env описаны; без настроенного S3 приложение стартует, фото-эндпоинты отвечают понятной ошибкой.
- [ ] API фото в shared, backend/frontend typecheck зелёные.
- [ ] Проверено вручную на dev-бакете владельца: загрузка, публичная ссылка открывается, заголовок `Cache-Control: immutable`, удаление.
- [ ] Nginx пропускает 6 МБ на `/api/`.
- [ ] Unit + integration тесты, `.agents/architecture.md` (S3, ключи, env) и `setup.md` обновлены.

## План

<!-- заполняется при взятии в работу -->

## Результат

<!-- заполняется при завершении -->

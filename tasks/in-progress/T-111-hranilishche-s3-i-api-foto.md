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

- [x] S3-модуль и env описаны; без настроенного S3 приложение стартует, фото-эндпоинты отвечают понятной ошибкой.
- [x] API фото в shared, backend/frontend typecheck зелёные.
- [ ] Проверено вручную на dev-бакете владельца: загрузка, публичная ссылка открывается, заголовок `Cache-Control: immutable`, удаление.
- [ ] Nginx пропускает 6 МБ на `/api/` (`client_max_body_size 6m` добавлен; проверить на сервере/в контейнере).
- [x] Unit + integration тесты, `.agents/architecture.md` (S3, ключи, env) и `setup.md` обновлены.

## План

1. **shared** (первым коммитом, по нему пишется фронтенд T-112): `CostumePhoto`, `CostumePhotoSummary` (`coverThumbUrl?`, `photoCount`) в `Costume` и в заказах бирок / выдачи / возврата / деталей визита; multipart-загрузка, список, порядок, удаление.
2. **backend**: `S3Module` (`src/storage/`), миграция `CostumePhoto`, модуль `costume-photos` (контроллер, сервис, проверка сигнатуры, лимиты multer), `CostumePhotoSummaryService` для `coverThumbUrl/photoCount` в костюмах и заказах.
3. **infra**: `client_max_body_size 6m` для `/api/`, `.env.example`.
4. **тесты**: unit сервиса фото (мок S3 и Prisma) + integration (мок `S3StorageService` в `test-app.ts`).
5. **доки**: `architecture.md` (S3, ключи, env), `setup.md` (env), `backend.md`/`domain.md` при необходимости.

## Результат

**Статус 2026-10-25:** код, тесты и документация готовы; **не проверено вручную на реальном бакете** (S3-переменных в `apps/backend/.env` ещё нет) — задача остаётся в `in-progress` до ручной проверки (загрузка, открытие публичной ссылки, заголовок `Cache-Control: immutable`, удаление).

### Контракт фото для фронтенда (T-112)

Все пути с префиксом `/costumes/{costumeId}/photos`, нужен Bearer; клиент — `apiClient` из `@costumes/shared`.

| Метод и путь | Тело | Ответ |
|---|---|---|
| `POST /costumes/{costumeId}/photos` | `multipart/form-data`: файлы `image` (≤ 2 МБ), `thumb` (≤ 200 КБ), только `image/jpeg` / `image/webp`; текстовые поля `width`, `height` — размеры **основного** фото в пикселях (1…10000) | `201` `CostumePhoto` |
| `GET …/photos` | — | `CostumePhoto[]` по порядку (первое — обложка) |
| `PATCH …/photos/order` | `{ photoIds: number[] }` — **все** id активных фото костюма в новом порядке | `200` `CostumePhoto[]` |
| `DELETE …/photos/{photoId}` | — | `204` |

`CostumePhoto = { id, url, thumbUrl, width, height }` (`url`/`thumbUrl` — публичные ссылки на S3, неизменяемые, кэш на год).

Ошибки (`message` — по-русски, показывать как есть): `400` — не JPEG/WebP (проверяется сигнатура файла, а не mime), файл больше лимита, нет `thumb`, плохие `width`/`height`; `413` — основное фото больше 2 МБ (multer); `404` — костюм/фото не найдены или удалены; `409` — уже 15 фото (удалить лишнее); `502` — S3 отклонил загрузку (можно повторить); `503` — S3 не настроен на сервере.

Заметки для фронтенда:
- Параллельные загрузки безопасны: лимит 15 и порядок защищены блокировкой строки костюма; последние лишние запросы получат `409`. Новое фото ставится в конец.
- Типы и схемы: `CostumePhotoDto`, `ReorderCostumePhotosRequestDto`, `UploadCostumePhotoFieldsSchema` (`shared/src/costumes.ts`); в `FormData` кладутся `image`, `thumb` (Blob с `type: image/jpeg|webp`) и строки `width`, `height`. Запрос **не** должен задавать `Content-Type` вручную (boundary подставит браузер).
- `coverThumbUrl?` (отсутствует, если фото нет) и `photoCount` (`default 0`) приходят в: `Costume` (создание/изменение, список, поиск, занятость, `search-available`), `Order` бирок (`/visits/not_written`), заказах `for-issue` (новая модель `VisitIssueOrder`), `for-return`, карточке визита (`VisitReadOrder`). В списках показывать только превью, большое фото открывать по `GET …/photos`.

### Что сделано

- `shared`: контракт (TypeSpec → `costumes.tsp`, экспорт в `costumes.ts`, `schemas.ts`), коммит `feat(shared): add costume photo API contract` (+ правка `photoCount = 0` в коммите backend).
- backend: `storage/` (`S3Module` глобальный, `S3StorageService`: `putObject`/`deleteObject`/`getPublicUrl`, `Cache-Control: immutable`, без env приложение стартует, методы бросают 503), `costume-photos/` (контроллер, сервис, проверка сигнатуры, лимиты), миграция `add_costume_photos` (только новая таблица), `CostumePhotosService.summaries` для обложек, фильтр ошибок `ApiExceptionFilter` теперь отдаёт русский текст для намеренных `502/503`.
- infra: `client_max_body_size 6m` для `/api/`, `.env.example` (корень и backend).
- тесты: unit сервиса фото (mime/сигнатура, лимиты, порядок, soft delete, удаление из S3 после коммита, очистка при сбое), unit фильтра, integration `costume-photos.int-spec.ts` (загрузка → список → порядок → удаление, обложки в костюмах/бирках/выдаче/возврате/карточке, параллельные загрузки, 413/400/409/503); `test-app.ts` подменяет `S3StorageService`.
- доки: `architecture.md` (S3, ключи, env, порядок записи), `setup.md`, `backend.md`, `domain.md`, `testing.md`, `shared-api.md`.

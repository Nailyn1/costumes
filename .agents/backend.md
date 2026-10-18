# Backend: правила разработки (`apps/backend`)

NestJS 11, TypeScript, Prisma 7 (`prisma-client` генератор + `@prisma/adapter-pg`), ioredis, BullMQ, Socket.IO, nestjs-pino, Sentry.

## 1. Структура

```
src/
├── main.ts                 # bootstrap: TZ=UTC, CORS, глобальные pipe/filter/interceptor, порт 5000
├── instrument.ts           # Sentry.init (импортируется первым)
├── app.module.ts
├── auth/                   # login / refresh / logout, JWT-стратегии, guards (HTTP + WS)
├── client-child/           # клиенты, дети, чёрный список (2 контроллера, 1 сервис)
├── costumes/               # костюмы, поиск, занятость
├── visit-order/            # визиты и заказы: бронь, бирки, выдача, возврат, отмена, залоги
├── notification/           # WhatsApp: сервис, BullMQ-процессор, Green-API провайдер, вебхук, WS-gateway
├── prisma/                 # PrismaService, seed.ts, generated/ (НЕ редактировать, НЕ коммитить)
├── redis/                  # Redis-провайдер, QueueModule, IdempotencyInterceptor
├── common/
│   ├── zod-dto.ts          # createZodDto(schema)
│   ├── pipes/zod-validation.pipe.ts
│   ├── filters/prisma-client-exception.filter.ts
│   ├── interceptors/sentry.interceptor.ts
│   └── utils/              # search.utils.ts (поиск+ранжирование), visit-message.utils.ts
└── config/                 # jwt.config.ts, logger.config.ts, cors.config.ts (список origin для HTTP и Socket.IO)
```

Новый домен = новый модуль `src/<domain>/` с `<domain>.module.ts`, `<domain>.controller.ts`, `<domain>.service.ts`, `dto/<domain>.dto.ts`.

## 2. Слои

- **Controller** — только HTTP: роут, guard, парсинг params/query, вызов сервиса, возврат результата. Без бизнес-логики и без Prisma.
- **Service** (`@Injectable()`) — вся бизнес-логика и все обращения к Prisma/Redis/очередям. Слоя репозиториев нет и не вводим.
- Все защищённые эндпоинты — `@UseGuards(JwtAuthGuard)` на методе. Без `JwtAuthGuard` только `auth/login`, `auth/refresh` (свой `JwtRefreshGuard`) и вебхук `webhooks/whatsapp` (защищён `WebhookTokenGuard`, токен Green-API).

## 3. Контракт и валидация (критично)

- Типы request/response **только из `@costumes/shared`**. Не объявляй локальные интерфейсы для API-тел. Нужен новый тип → сначала TypeSpec (см. [shared-api.md](./shared-api.md)).
- Валидация входа — через DTO-класс из Zod-схемы:
  ```ts
  // dto/costumes.dto.ts
  export class CreateCostumesRequest extends createZodDto(CreateCostumesRequestSchema) {}
  // controller
  @Post() @UseGuards(JwtAuthGuard)
  async costumeCreate(@Body() dto: CreateCostumesRequest): Promise<CreateUpdateCostumesResponseDto> {
    return this.costumesService.createCostume(dto);
  }
  ```
  Глобальный `ZodValidationPipe` валидирует всё, у чего есть статическое `schema`, и отдаёт 400 `{ message: 'Validation failed', errors }`.
- Числовые params — `ParseIntPipe`; пагинация — `DefaultValuePipe(1|20)` + `ParseIntPipe`; ответ пагинации: `{ items, total, page, limit, hasMore }`.
- Сложные ответы можно прогонять через `ResponseSchema.parse(...)` перед возвратом (так сделано в `createVisit`, `findOrdersNotWritten`).
- Порядок роутов: статические пути (`search`, `list`, `issued`) объявлять **до** параметрических (`:id`), если они на одном уровне.

## 4. Ошибки

- Бросай Nest-исключения: `BadRequestException`, `NotFoundException`, `ConflictException`. **Сообщения — на русском**, понятные сотруднику: фронт показывает `message` прямо в уведомлении.
- Ошибки Prisma не пробрасывай сырыми: `P2002` → 409, `P2025` → 404 обрабатывает глобальный `PrismaClientExceptionFilter`; остальные коды — лови в сервисе (пример: `P2003` в `createVisit`).

## 5. База данных (Prisma)

- Клиент: `PrismaService` (наследник `PrismaClient`), импорт типов — `from '../prisma/generated/client'`.
- **Prisma Client, не raw SQL.** `$queryRaw` — только для аналитики, где Prisma не справляется.
- **Транзакции** (`this.prisma.$transaction(async (tx) => ...)`) — для любой операции, меняющей больше одной таблицы/строки по смыслу (визит + заказы, выдача, возврат, отмена).
- **Soft delete:** удаление = `deletedAt: new Date()`. В каждой выборке клиентов/детей/костюмов/визитов/заказов — `deletedAt: null` (включая вложенные `include: { orders: { where: { deletedAt: null } } }`). `deleteMany`/`delete` запрещены для доменных сущностей.
- **Время:** `TZ=UTC`, местное время хранится как UTC «как есть» (см. [domain.md](./domain.md#время-и-даты-важно)). Склеивание даты и времени — `new Date(\`${date}T${time}:00Z\`)`. Даты наружу — `toISOString().split('T')[0]`.
- **Миграции:**
  1. правишь `prisma/schema.prisma`;
  2. `pnpm exec prisma migrate dev --name <snake_case_описание>` (из `apps/backend`, БД из `docker-compose.dev.yml` должна быть запущена);
  3. проверяешь SQL в `prisma/migrations/<ts>_<name>/migration.sql` — миграции уходят в прод через `prisma migrate deploy` при деплое;
  4. **никогда** не редактируй уже применённые миграции.
  Деструктивные миграции (drop column, смена типа, NOT NULL без default) — только с явного согласия владельца: в проде живые данные сезона.
- `prisma generate` пишет в `src/prisma/generated` (в `.gitignore`).

## 6. Redis

- Ключи — с понятным префиксом домена: `visit_code_lock:`, `whatsapp:instance:`, `idempotency:`, `rf:` (см. [architecture.md](./architecture.md#redis--для-чего-используется)). Новые ключи — в том же стиле.
- Всегда ставь TTL (`'EX', seconds`), кроме осознанно постоянных состояний.
- Клиент — через `@Inject(REDIS_CLIENT) private readonly redis: Redis`.

## 7. Идемпотентность

`IdempotencyInterceptor` глобален: для POST/PATCH/PUT с заголовком `X-Idempotency-Key` (фронт ставит его автоматически) повтор возвращает закэшированный ответ, параллельный дубль — 409. Учитывай это при отладке «почему второй запрос не выполнился».

## 8. Очереди и уведомления

- Очередь `notifications` (BullMQ, `attempts: 10` с backoff). Job: `send-whatsapp` с `{ notificationId, traceId }`, `jobId = notification-{id}`.
- Отправка сообщений — **только через очередь**, никогда синхронно в запросе.
- Логика вебхуков и статусов — в `NotificationService` (см. [domain.md §5](./domain.md#5-whatsapp-уведомления-green-api)).

## 9. Логирование

- `@InjectPinoLogger(ClassName.name) private readonly logger: PinoLogger`. Логи структурные: `logger.info({ visitId, notificationId }, 'Message')`.
- Для цепочек уведомлений — child-логгер с `traceId`.
- Не логируй пароли, токены, полные тела с персональными данными (телефон редактируется в pino `redact`).

## 10. TypeScript и стиль

- `any` запрещён → `unknown` + type guard. `as unknown as X` — только при интеграции с нетипизированными библиотеками, с комментарием почему.
- Prettier: `singleQuote: true`, `trailingComma: 'all'`. ESLint: `eslint.config.mjs` (typescript-eslint type-checked).
- `pnpm --filter @costumes/backend lint` проверяет `src/` и `test/` без изменений файлов; `pnpm --filter @costumes/backend lint:fix` применяет автоисправления.
- Предпочитай `const`, `map/filter/reduce`, ранний `return`.
- Комментарии — на русском или английском, коротко; только когда «почему» неочевидно.

## 11. Проверки перед завершением задачи

```bash
pnpm --filter @costumes/shared build        # если менялся shared
pnpm --filter @costumes/backend typecheck   # tsc --noEmit, включая test/
pnpm --filter @costumes/backend lint
pnpm --filter @costumes/backend test       # unit
pnpm --filter @costumes/backend test:int   # integration (если задача трогает backend)
```


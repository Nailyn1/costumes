# Локальный запуск и команды

## 1. Требования

- Node.js 24.9+ LTS (`.nvmrc`, `engines.node` в корневом `package.json`, `node:24-alpine` в обоих Dockerfile). Локальная системная версия 22.16 ниже минимума; перед штатным запуском обнови Node до 24.9+.
- Генераторы Nest CLI (`nest generate`, `nest upgrade`) требуют Node 24.15+ из-за `@nestjs/schematics`. При использовании менеджера версий `.nvmrc=24` выбирает актуальный выпуск ветки 24.x.
- pnpm 10 (версия зафиксирована в `packageManager` корневого `package.json`; включается через `corepack enable`). Менеджер пакетов — только pnpm, `npm install` не использовать.
- Docker Desktop — для Postgres и Redis.
- ОС разработки — Windows (PowerShell / Git Bash). Учитывай CRLF/LF (задача [T-003](../tasks/backlog/T-003-okonchaniya-strok.md)).

## 2. Переменные окружения

Файлы `.env` в git **не коммитятся**. Шаблоны с плейсхолдерами лежат рядом: `apps/backend/.env.example`, корневой `.env.example`, `apps/crm-frontend/.env.development.example` — скопируй в `.env` / `.env.development` и заполни. Список переменных ниже.

**`apps/backend/.env`** (backend читает `.env` из cwd и `apps/backend/.env`; Prisma CLI — из `apps/backend`):

| Переменная | Пример для dev | Назначение |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:123456@localhost:5432/costumes?schema=public` | Prisma |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `postgres` / `123456` / `costumes` | контейнер Postgres (прод-compose) |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_URL` | `localhost` / `6379` / `redis://localhost:6379` | Redis и BullMQ |
| `PORT` | `5000` | порт API |
| `CLIENT_URL` | `http://localhost:5173` | CORS: HTTP и Socket.IO используют один список origin (`src/config/cors.config.ts`: `CLIENT_URL` + localhost) |
| `SERVER_URL`, `SERVER_DOMAIN` | | URL сервера |
| `JWT_SECRET` | любая длинная строка | подпись JWT |
| `GREEN_API_URL`, `GREEN_API_ID_INSTANCE`, `GREEN_API_TOKEN` | | WhatsApp (Green-API); ID инстанса — только `GREEN_API_ID_INSTANCE` (по нему же ключ статуса в Redis; старая `INSTANCE_ID` удалена, на сервере её можно убрать из `.env`). Тестового инстанса пока нет — локально отправка падает, это нормально |
| `GREEN_API_WEBHOOK_TOKEN` | длинная случайная строка | токен вебхука `POST /webhooks/whatsapp` (`Authorization: Bearer`). Не задан: в `production` вебхук отвечает 401, в остальных окружениях пропускается с warning в логе. Настройка в Green-API — [domain.md §5](./domain.md#5-whatsapp-уведомления-green-api) |
| `SENTRY_DSN` | пусто | Sentry backend |
| `NODE_ENV` | `development` | `production` включает secure-cookie и файловые логи без pretty |
| `USER{1..5}_LOGIN/NAME/PASSWORD` | | пользователи для seed (login ≥ 6 символов, пароль ≥ 12) |

Корневой `.env` используется прод-`docker-compose.yaml` (те же переменные).

**`apps/backend/.env.test`** (для `pnpm test:int`, не коммитится): шаблон — `apps/backend/.env.test.example` (`DATABASE_URL` на БД `costumes_test`, `REDIS_DB=15`, тестовый сотрудник). Подробно — [testing.md §3.3](./testing.md#33-настройка-окружения-для-integration).

**`apps/crm-frontend/.env.development`**: `VITE_API_URL=http://localhost:5000`, `VITE_SOCKET_URL=http://localhost:5000`. Прод — `.env.production` (`/api`, `/`), в git.

## 3. Первый запуск

```bash
# 1. зависимости (из корня)
pnpm install

# 2. инфраструктура: Postgres 15 + Redis 7
docker compose -f docker-compose.dev.yml up -d

# 3. shared
pnpm --filter @costumes/shared build

# 4. БД
cd apps/backend
pnpm exec prisma migrate dev # применит миграции и сгенерирует клиент в src/prisma/generated
pnpm db:seed                  # создаст пользователей из USER*_ переменных
cd ../..

# 5. запуск (два терминала, из корня)
pnpm dev:backend              # nest start backend --watch → http://localhost:5000
pnpm dev:frontend             # vite → http://localhost:5173
```

`docker-compose.dev.yml` лежит в git. Пользователь, пароль и имя БД берутся из `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` (корневой `.env`), по умолчанию `postgres` / `123456` / `costumes`. Имена контейнеров `dev-postgres` / `dev-redis` и volume `dev_postgres_data` не менять — на них живут dev-данные.

## 4. Команды

### Корень
| Команда | Что делает |
|---|---|
| `pnpm dev:backend` | backend в watch-режиме |
| `pnpm dev:frontend` | frontend dev-сервер |
| `pnpm dev:shared` | `tsc -b --watch` в shared |
| `pnpm start:dev` | shared watch + backend вместе |
| `pnpm build` | сборка backend |
| `pnpm test` | unit-тесты backend + frontend |
| `pnpm test:int` | integration-тесты backend (нужны dev Postgres/Redis, см. [testing.md §3.3](./testing.md#33-настройка-окружения-для-integration)) |

### shared (`cd shared`)
| `pnpm gen:api` | TypeSpec → OpenAPI → `src/openapi-client.ts` |
|---|---|
| `pnpm build` | `tsc --build --force` → `dist/` |

### backend (`cd apps/backend`)
| Команда | Что делает |
|---|---|
| `pnpm exec prisma migrate dev --name <name>` | новая миграция + generate |
| `pnpm exec prisma generate` | только перегенерировать клиент |
| `pnpm exec prisma studio` | GUI для БД |
| `pnpm db:seed` | пользователи |
| `pnpm lint` | ESLint для `src/` и `test/`, без изменений файлов |
| `pnpm lint:fix` | ESLint с автоматическими исправлениями для `src/` и `test/` |
| `pnpm exec tsc --noEmit -p tsconfig.json` | typecheck |
| `pnpm typecheck` | `tsc --noEmit` вместе с `test/` |
| `pnpm test` | Jest unit (`src/**/*.spec.ts`) |
| `pnpm test:int` | Jest integration (`test/*.int-spec.ts`, БД `costumes_test`) |
| `pnpm test:db:reset` | пересоздать `costumes_test` с нуля (вручную) |

### frontend (`cd apps/crm-frontend`)
| `pnpm exec tsc -b` | typecheck |
|---|---|
| `pnpm lint` | ESLint |
| `pnpm build` | `tsc -b && vite build` |
| `pnpm preview` | предпросмотр прод-сборки |
| `pnpm test` / `pnpm test:watch` | Vitest |

## 5. Частые проблемы

- **Backend не видит новые типы shared** → не выполнен `pnpm --filter @costumes/shared build`.
- **`Cannot find module '../prisma/generated/client'`** → `pnpm exec prisma generate` в `apps/backend`.
- **ESLint backend: сотни ошибок `Insert ␍`/`Delete ␍`** → проблема окончаний строк на Windows ([T-003](../tasks/backlog/T-003-okonchaniya-strok.md)), к логике отношения не имеет.
- **WhatsApp не отправляется локально** → нет тестового инстанса Green-API; job уйдёт в ретраи — это ожидаемо.
- **409 «Request already in progress»** → сработал `IdempotencyInterceptor` (повтор запроса с тем же `X-Idempotency-Key`).

## 6. Работа в git worktree (параллельные сессии агентов)

Параллельные сессии Claude Desktop работают каждая в своём worktree (создаётся автоматически). Основная папка проекта — `C:\JavaScript\costumes`.

**Подготовка нового worktree** (один раз, из корня worktree):

1. Скопировать файлы из gitignore из основной папки — в worktree их нет:
   - `apps/backend/.env`
   - `apps/backend/.env.test` (только если нужны integration-тесты; иначе берётся `.env.test.example`)
   - `apps/crm-frontend/.env.development`
   - `.env` (корневой, если нужен)
2. `pnpm install`.
3. `pnpm --filter @costumes/shared build`.
4. `cd apps/backend && pnpm exec prisma generate`.

**Общие ресурсы — одни на все worktree:**
- **Dev-база и Redis одни** (контейнеры из `docker-compose.dev.yml`). Не поднимай второй экземпляр. Миграции (`prisma migrate dev`) — только в одной сессии одновременно; если задача требует миграции, а другая сессия тоже меняет схему — согласовать с владельцем.
- **Порты 5000 (backend) и 5173 (frontend)** — dev-серверы одновременно может держать только одна сессия. Закончил ручную проверку — останови свои серверы.

**Правила веток и коммитов в сессиях** (согласовано владельцем):
- Каждая сессия работает в своей ветке `<type>/<short-description>`, базовая ветка указывается в задании сессии.
- **Одна задача = один коммит** в своей ветке (Conventional Commits), файл задачи переносится в `tasks/done/` в том же коммите.
- **Без push и без merge** — владелец смотрит коммиты и сам решает, что вливать.
- Сессии с пересекающимися файлами одновременно не запускаются (особенно `package.json`/lock-файл, `visit-order.service.ts`, `shared/api-spec`).

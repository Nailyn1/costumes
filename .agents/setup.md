# Локальный запуск и команды

> ⚠️ Сейчас проект на **npm workspaces**. Запланирован переход на **pnpm** (задача [T-002](../tasks/backlog/T-002-perehod-na-pnpm.md)) — после него этот файл обновляется в той же задаче.

## 1. Требования

- Node.js 22 LTS (локально сейчас 22.16; в Dockerfile пока `node:20-alpine` — к обновлению).
- npm 11 (будет pnpm 10).
- Docker Desktop — для Postgres и Redis.
- ОС разработки — Windows (PowerShell / Git Bash). Учитывай CRLF/LF (задача [T-003](../tasks/backlog/T-003-okonchaniya-strok.md)).

## 2. Переменные окружения

Файлы `.env` в git **не коммитятся**. Шаблона `.env.example` пока нет ([T-004](../tasks/backlog/T-004-env-example.md)) — список ниже.

**`apps/backend/.env`** (backend читает `.env` из cwd и `apps/backend/.env`; Prisma CLI — из `apps/backend`):

| Переменная | Пример для dev | Назначение |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:123456@localhost:5432/costumes?schema=public` | Prisma |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `postgres` / `123456` / `costumes` | контейнер Postgres (прод-compose) |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_URL` | `localhost` / `6379` / `redis://localhost:6379` | Redis и BullMQ |
| `PORT` | `5000` | порт API |
| `CLIENT_URL` | `http://localhost:5173` | CORS |
| `SERVER_URL`, `SERVER_DOMAIN` | | URL сервера |
| `JWT_SECRET` | любая длинная строка | подпись JWT |
| `GREEN_API_URL`, `GREEN_API_ID_INSTANCE`, `GREEN_API_TOKEN`, `INSTANCE_ID` | | WhatsApp (Green-API). Тестового инстанса пока нет — локально отправка падает, это нормально |
| `SENTRY_DSN` | пусто | Sentry backend |
| `NODE_ENV` | `development` | `production` включает secure-cookie и файловые логи без pretty |
| `USER{1..5}_LOGIN/NAME/PASSWORD` | | пользователи для seed (login ≥ 6 символов, пароль ≥ 12) |

Корневой `.env` используется прод-`docker-compose.yaml` (те же переменные).

**`apps/crm-frontend/.env.development`**: `VITE_API_URL=http://localhost:5000`, `VITE_SOCKET_URL=http://localhost:5000`. Прод — `.env.production` (`/api`, `/`), в git.

## 3. Первый запуск

```bash
# 1. зависимости (из корня)
npm install

# 2. инфраструктура: Postgres 15 + Redis 7
docker compose -f docker-compose.dev.yml up -d

# 3. shared
cd shared && npm run build && cd ..

# 4. БД
cd apps/backend
npx prisma migrate dev        # применит миграции и сгенерирует клиент в src/prisma/generated
npm run db:seed               # создаст пользователей из USER*_ переменных
cd ../..

# 5. запуск (два терминала, из корня)
npm run dev:backend           # nest start backend --watch → http://localhost:5000
npm run dev:frontend          # vite → http://localhost:5173
```

`docker-compose.dev.yml` сейчас в `.gitignore` (содержит dev-пароль) — если файла нет, он такой:

```yaml
services:
  postgres:
    image: postgres:15-alpine
    container_name: dev-postgres
    ports: ["5432:5432"]
    environment: [POSTGRES_USER=postgres, POSTGRES_PASSWORD=123456, POSTGRES_DB=costumes]
    volumes: [dev_postgres_data:/var/lib/postgresql/data]
  redis:
    image: redis:7-alpine
    container_name: dev-redis
    ports: ["6379:6379"]
volumes:
  dev_postgres_data:
```

## 4. Команды

### Корень
| Команда | Что делает |
|---|---|
| `npm run dev:backend` | backend в watch-режиме |
| `npm run dev:frontend` | frontend dev-сервер |
| `npm run dev:shared` | `tsc -b shared --watch` |
| `npm run start:dev` | shared watch + backend вместе |
| `npm run build` | сборка backend |

### shared (`cd shared`)
| `npm run gen:api` | TypeSpec → OpenAPI → `src/openapi-client.ts` |
|---|---|
| `npm run build` | `tsc --build --force` → `dist/` |

### backend (`cd apps/backend`)
| Команда | Что делает |
|---|---|
| `npx prisma migrate dev --name <name>` | новая миграция + generate |
| `npx prisma generate` | только перегенерировать клиент |
| `npx prisma studio` | GUI для БД |
| `npm run db:seed` | пользователи |
| `npm run lint` | ESLint с `--fix` |
| `npx tsc --noEmit -p tsconfig.json` | typecheck |
| `npm run test` / `test:e2e` | Jest (тестов пока нет) |

### frontend (`cd apps/crm-frontend`)
| `npx tsc -b` | typecheck |
|---|---|
| `npm run lint` | ESLint |
| `npm run build` | `tsc -b && vite build` |
| `npm run preview` | предпросмотр прод-сборки |

## 5. Частые проблемы

- **Backend не видит новые типы shared** → не выполнен `npm run build` в `shared`.
- **`Cannot find module '../prisma/generated/client'`** → `npx prisma generate` в `apps/backend`.
- **ESLint backend: сотни ошибок `Insert ␍`/`Delete ␍`** → проблема окончаний строк на Windows ([T-003](../tasks/backlog/T-003-okonchaniya-strok.md)), к логике отношения не имеет.
- **WhatsApp не отправляется локально** → нет тестового инстанса Green-API; job уйдёт в ретраи — это ожидаемо.
- **409 «Request already in progress»** → сработал `IdempotencyInterceptor` (повтор запроса с тем же `X-Idempotency-Key`).

## 6. Работа в git worktree (параллельные сессии агентов)

Параллельные сессии Claude Desktop работают каждая в своём worktree (создаётся автоматически). Основная папка проекта — `C:\JavaScript\costumes`.

**Подготовка нового worktree** (один раз, из корня worktree):

1. Скопировать файлы из gitignore из основной папки — в worktree их нет:
   - `apps/backend/.env`
   - `apps/crm-frontend/.env.development`
   - `.env` (корневой, если нужен)
   - `docker-compose.dev.yml` (если ещё не в git — T-006)
2. `npm install` (после T-002 — `pnpm install`).
3. `cd shared && npm run build`.
4. `cd apps/backend && npx prisma generate`.

**Общие ресурсы — одни на все worktree:**
- **Dev-база и Redis одни** (контейнеры из `docker-compose.dev.yml`). Не поднимай второй экземпляр. Миграции (`prisma migrate dev`) — только в одной сессии одновременно; если задача требует миграции, а другая сессия тоже меняет схему — согласовать с владельцем.
- **Порты 5000 (backend) и 5173 (frontend)** — dev-серверы одновременно может держать только одна сессия. Закончил ручную проверку — останови свои серверы.

**Правила веток и коммитов в сессиях** (согласовано владельцем):
- Каждая сессия работает в своей ветке `<type>/<short-description>`, базовая ветка указывается в задании сессии.
- **Одна задача = один коммит** в своей ветке (Conventional Commits), файл задачи переносится в `tasks/done/` в том же коммите.
- **Без push и без merge** — владелец смотрит коммиты и сам решает, что вливать.
- Сессии с пересекающимися файлами одновременно не запускаются (особенно `package.json`/lock-файл, `visit-order.sevice.ts`, `shared/api-spec`).

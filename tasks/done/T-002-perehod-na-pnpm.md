# T-002 · Переход на pnpm

- **Приоритет:** high — до сезона обязательно
- **Область:** Инфраструктура и гигиена репозитория
- **Создана:** 2026-10-15
- **Выполнена:** 2026-10-15

## Контекст

`pnpm-workspace.yaml`, `catalog:` для общих версий (typescript, zod, eslint), удалить `package-lock.json`, обновить скрипты, Dockerfile'ы, CI, `.agents/setup.md`. Проверить работу Prisma / argon2 / Nest CLI.

## Критерии готовности

- [x] `pnpm-workspace.yaml` (`apps/*`, `shared`), `catalog:` для `typescript`, `zod`, `eslint`, `@eslint/js`, `globals`, `typescript-eslint`
- [x] `packageManager: pnpm@10.18.3` в корневом `package.json`; `workspaces` и npm-`overrides` убраны, zod-override перенесён в `pnpm-workspace.yaml`
- [x] `package-lock.json` удалён, `pnpm-lock.yaml` получен через `pnpm import` (версии пакетов сохранены)
- [x] корневые скрипты переведены на pnpm
- [x] оба Dockerfile на corepack + `pnpm install --frozen-lockfile`; прод-образ backend собирается через `pnpm deploy --prod`
- [x] документация (`AGENTS.md`, `.agents/*`) переведена на pnpm-команды
- [x] проверено: сборка shared, `gen:api` (результат не изменился), `prisma generate`, backend `tsc` / `nest build` / `nest start` (против одноразовой БД), `db:seed`, argon2 hash/verify, frontend `tsc -b` / lint / `vite build`
- [x] проверено в Docker: сборка образов backend и frontend (см. «Результат»)

## Результат

- **Workspace:** `pnpm-workspace.yaml` с `catalog:`; внутренняя зависимость `@costumes/shared` теперь `workspace:*`. `@types/node` в каталог не вынесен (backend `^22`, frontend `^24` — намеренно разные). Версии установленных пакетов не менялись (typescript 5.9.3, eslint 9.39.3, prisma 7.4.1, zod 3.25.76 и т. д.).
- **Фантомные зависимости** (в npm работали благодаря hoisting, pnpm их не пропускает): `zod` добавлен в `shared`, `apps/backend`, `apps/crm-frontend` (раньше был только в корне); `dotenv` добавлен в `apps/backend` (его импортируют `seed.ts` и `prisma.config.ts`).
- **`prisma` CLI перенесён из devDependencies в dependencies backend.** Деплой выполняет `docker compose exec ... npx prisma migrate deploy` внутри прод-образа, где devDependencies отсутствуют, — раньше `npx` в этот момент скачивал `prisma@latest` из сети. Теперь используется закреплённая в lock-файле версия 7.4.1. Версии не менялись.
- **Build-скрипты зависимостей:** pnpm 10 блокирует postinstall по умолчанию, поэтому `onlyBuiltDependencies` перечисляет `@nestjs/core`, `@prisma/client`, `@prisma/engines`, `@sentry-internal/node-cpu-profiler`, `argon2`, `esbuild`, `msgpackr-extract`, `prisma`, `protobufjs`, `unrs-resolver`.
- **Docker backend:** builder делает `pnpm install --frozen-lockfile` → build shared → `prisma generate` → `nest build` → `pnpm deploy --prod /prod/backend`; в прод-стейдж копируются `node_modules`, `dist`, `prisma`, `prisma.config.ts` (раскладка `/app/apps/backend` сохранена, команда деплоя из `.github/workflows/deploy.yaml` не менялась). Для `pnpm deploy` в pnpm 10 нужны `--config.inject-workspace-packages=true` и `forceLegacyDeploy: true` в `pnpm-workspace.yaml` (общий lockfile-режим deploy падает с `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`). `injectWorkspacePackages` в yaml намеренно не включён — он ломает watch-режим shared в dev.
- **`.dockerignore`:** `node_modules` → `**/node_modules` (иначе `shared/node_modules` с pnpm-симлинками попадал бы в контекст сборки).
- **`.github/workflows/deploy.yaml`** не менялся: он вызывает `docker compose build`, всё остальное внутри Dockerfile.
- **Старые инструменты:** `package-lock.json` удалён; `npm install` больше не используется.
- **Проверка запуска:** dev-контейнеры Postgres/Redis из `docker-compose.dev.yml` в момент проверки не работали, а порты 5432/6379 были заняты контейнерами другого проекта, поэтому backend запускался против одноразовых контейнеров на портах 15432/16379 (миграции применены с нуля, `db:seed` создал пользователей, `POST /auth/login` отвечает 400 на невалидное тело); контейнеры удалены.
- **Docker:** оба образа (`apps/backend/Dockerfile`, `apps/crm-frontend/Dockerfile`) собраны локально. Прод-образ backend запущен против одноразовых Postgres/Redis: приложение стартует, argon2 работает, `require('@costumes/shared')` ок, `npx prisma migrate status` внутри контейнера использует локальный prisma 7.4.1 и видит все 18 миграций применёнными (в логах только ожидаемая ошибка Green-API 403 — нет инстанса). Полный `docker compose build` с прод-compose не запускался — собирались те же Dockerfile напрямую.

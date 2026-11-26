# T-039 · Проверка Docker-сборки на pnpm

- **Приоритет:** high — до сезона обязательно
- **Область:** Инфраструктура
- **Создана:** 2026-10-17
- **Выполнена:** 2026-10-17

## Контекст

Проект переведён на pnpm workspaces, Dockerfile backend переписан на `pnpm deploy --prod`, но образы после этого ни разу не собирались. Блокер перед мержем в `main` (автодеплой).

## Критерии готовности

- [x] `docker compose build` собирает backend и frontend
- [x] Прод-стек поднимается локально (изолированно от dev-контейнеров), backend стартует и отвечает
- [x] `prisma migrate deploy` проходит ровно той командой, что в `.github/workflows/deploy.yaml`
- [x] Nginx отдаёт SPA и проксирует `/api/` и `/socket.io/`

## План

Прод-стек под отдельным project name `costumes-check`, временный override вне репозитория: без публикации 5432, фронт на `8080:80`/`8443:443` с самоподписанным сертификатом (иначе блок `listen 443` не стартует), свой env-файл с тестовыми значениями. После проверки `down -v`.

## Результат

Сборка и запуск работают без правок Dockerfile.

- `docker compose build` — оба образа собраны (`pnpm install --frozen-lockfile`, build shared, `prisma generate`, `pnpm deploy --prod`).
- `up -d` — все 5 контейнеров Up; backend: «Nest application successfully started» (ошибка 403 от Green-API ожидаема — ключей нет).
- `docker compose exec -T -w /app/apps/backend backend npx prisma migrate deploy` — все миграции применены на пустой БД, повторный запуск — «No pending migrations»; prisma CLI есть в прод-образе (`npx --no-install prisma -v` работает).
- Nginx: SPA (`/` и глубокая ссылка `/visits/x` → 200), `/api/costumes/list` → 401 от backend (проксирование работает, префикс срезается), `/socket.io/?EIO=4&transport=polling` → 200 с `sid`.
- Нюанс проверки: `docker compose` интерполирует `${POSTGRES_*}` из корневого `.env`, а контейнер postgres берёт `env_file` — значения должны совпадать (на сервере это один и тот же `.env`).
- Исправление: `.dockerignore` не исключал `.env`, и `COPY . .` клал локальные секреты в слой builder-стадии (в итоговые образы они не попадали). Добавлены `**/.env`, `**/.env.*` с исключениями для `*.example` и `apps/crm-frontend/.env.production` (он нужен сборке фронта). Образы пересобраны и проверены повторно.
- Не проверено: реальные сертификаты, push в Docker Hub, SSH-деплой, `docker compose pull` на сервере.

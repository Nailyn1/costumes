# T-015 · Проверки в CI перед деплоем

- **Приоритет:** high — до сезона обязательно
- **Область:** CI/CD и качество
- **Создана:** 2026-10-15
- **Выполнена:** 2026-10-17

## Контекст

job `check` (install, shared build, typecheck, lint, test) обязателен перед `build-and-push`; обновить `actions/checkout@v3` → актуальную, `npm install` → `npm ci`/`pnpm install --frozen-lockfile` в Dockerfile'ах.

## Критерии готовности

- [x] Job `check`: install, build shared, prisma generate, typecheck и lint backend/frontend, тесты backend
- [x] `build-and-push` зависит от `check` (`needs`)
- [x] `check` запускается и на pull_request в main, без деплоя
- [x] Версии actions обновлены
- [x] Dockerfile'ы уже на `pnpm install --frozen-lockfile`

## Результат

В `.github/workflows/deploy.yaml` добавлен job `check`; `build-and-push` — `needs: check` и `if: push`. Actions: checkout@v5, pnpm/action-setup@v4, setup-node@v5 (Node 22, кеш pnpm), docker/login-action@v3, appleboy/ssh-action@v1.2.2. Проверено: `actionlint` (docker `rhysd/actionlint`) — без замечаний; каждый шаг check прогнан локально (typecheck, lint, 18 тестов зелёные, в т.ч. без `.env` в backend). Lint backend в CI — `eslint "src/**/*.ts"` без `--fix`: `test/app.e2e-spec.ts` вне tsconfig — вынесено в [T-040](../backlog/T-040-lint-test-vne-tsconfig.md). Ошибка `no-unsafe-return` и warning `no-floating-promises` исправлены отдельным коммитом (`fix(back)`). Не проверено: реальный прогон на GitHub (без push). Обновлён `.agents/architecture.md` §4.

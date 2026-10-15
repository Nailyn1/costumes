# T-015 · Проверки в CI перед деплоем

- **Приоритет:** high — до сезона обязательно
- **Область:** CI/CD и качество
- **Создана:** 2026-10-15

## Контекст

job `check` (install, shared build, typecheck, lint, test) обязателен перед `build-and-push`; обновить `actions/checkout@v3` → актуальную, `npm install` → `npm ci`/`pnpm install --frozen-lockfile` в Dockerfile'ах.

## Критерии готовности

- [ ] _уточнить при взятии в работу_

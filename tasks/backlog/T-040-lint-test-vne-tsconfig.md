# T-040 · ESLint не парсит `apps/backend/test/*.ts`

- **Приоритет:** low
- **Область:** CI/CD и качество
- **Создана:** 2026-10-17

## Контекст

`pnpm lint` в `apps/backend` (`eslint "{src,apps,libs,test}/**/*.ts" --fix`) падает на `test/app.e2e-spec.ts`: `Parsing error: parserOptions.project ... The file was not found in any of the provided project(s)` — `test/` не входит в `tsconfig.json` (`include: ["src/**/*.ts"]`). Из-за этого в CI (T-015) backend линтится только по `src/**/*.ts`. Также скрипт `lint` содержит `--fix`, что неудобно для проверки в CI.

## Критерии готовности

- [ ] Линт `test/` работает (отдельный `tsconfig.eslint.json` или `allowDefaultProject`) либо e2e-тесты оформлены осознанно
- [ ] Скрипт `lint` без `--fix` (отдельный `lint:fix`), CI использует `pnpm lint`

## План

<!-- заполняется при взятии в работу -->

## Результат

<!-- заполняется при завершении -->

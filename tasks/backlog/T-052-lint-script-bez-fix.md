# T-052 · Скрипт `lint` backend без `--fix`

- **Приоритет:** low
- **Область:** CI/CD и качество
- **Создана:** 2026-10-17

## Контекст

Найдено при T-015 (изначально заведена под номером T-040, перенумерована из-за коллизии с T-040 «Основа тестов»).

Скрипт `lint` в `apps/backend/package.json` — `eslint "{src,apps,libs,test}/**/*.ts" --fix`: он молча исправляет файлы, поэтому в CI (`.github/workflows/deploy.yaml`, job `check`) backend линтится в обход скрипта — `pnpm exec eslint "src/**/*.ts"`, без `test/`.

Первая часть исходной задачи (ESLint не парсил `apps/backend/test/*.ts`) уже решена в T-040: `eslint.config.mjs` использует `tsconfig.test.json`, `test/` линтится без ошибок.

## Критерии готовности

- [ ] `lint` — без `--fix`, отдельный скрипт `lint:fix`.
- [ ] CI вызывает `pnpm --filter @costumes/backend lint` (линтит `src` и `test`).
- [ ] Документация (`.agents/backend.md`, `.agents/setup.md`) использует новые скрипты.

## План

<!-- заполняется при взятии в работу -->

## Результат

<!-- заполняется при завершении -->

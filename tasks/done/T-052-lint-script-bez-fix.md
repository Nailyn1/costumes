# T-052 · Скрипт `lint` backend без `--fix`

- **Приоритет:** low
- **Область:** CI/CD и качество
- **Создана:** 2026-10-17
- **Выполнена:** 2026-10-18

## Контекст

Найдено при T-015 (изначально заведена под номером T-040, перенумерована из-за коллизии с T-040 «Основа тестов»).

Скрипт `lint` в `apps/backend/package.json` — `eslint "{src,apps,libs,test}/**/*.ts" --fix`: он молча исправляет файлы, поэтому в CI (`.github/workflows/deploy.yaml`, job `check`) backend линтится в обход скрипта — `pnpm exec eslint "src/**/*.ts"`, без `test/`.

Первая часть исходной задачи (ESLint не парсил `apps/backend/test/*.ts`) уже решена в T-040: `eslint.config.mjs` использует `tsconfig.test.json`, `test/` линтится без ошибок.

## Критерии готовности

- [x] `lint` — без `--fix`, отдельный скрипт `lint:fix`.
- [x] CI вызывает `pnpm --filter @costumes/backend lint` (линтит `src` и `test`).
- [x] Документация (`.agents/backend.md`, `.agents/setup.md`) использует новые скрипты.

## План

- Убрать `--fix` из `lint`, добавить отдельный `lint:fix` для backend.
- Перевести CI на `pnpm --filter @costumes/backend lint`, чтобы проверялись `src/` и `test/`.
- Обновить backend/setup документацию и проверить новый lint script.

## Результат

- `lint` проверяет `src/` и `test/` без изменений файлов; автоисправления вынесены в `lint:fix`.
- CI вызывает backend `lint`-скрипт; документация обновлена.
- Проверки: ESLint для `src/` и `test/` запущен напрямую из локальных `node_modules` — успешно; синтаксис `apps/backend/package.json` проверен через `ConvertFrom-Json`.
- Приёмка: backend unit — 156 passed; integration — 6 passed; backend typecheck и shared build — успешно. Подготовка integration-БД через `pnpm` не запустилась из-за прав окружения; сами integration-тесты прошли на существующей тестовой БД.
- Коммит: текущий коммит задачи T-052.

# T-051 · ESLint: `no-unsafe-return` в `zod-validation.pipe.ts`

- **Приоритет:** low
- **Область:** Техдолг
- **Создана:** 2026-10-17
- **Выполнена:** 2026-10-17

## Контекст

Найдено при T-040: `pnpm --filter @costumes/backend lint` падает на `apps/backend/src/common/pipes/zod-validation.pipe.ts:34` (`@typescript-eslint/no-unsafe-return`, возврат значения типа `any`). Ошибка существовала до тестов.

Параллельно та же ошибка была исправлена в ветке деплоя (T-015) — коммит `d7c63d0 fix(back): resolve eslint error in zod pipe and floating bootstrap promise`.

## Критерии готовности

- [x] Типизация возврата без `any`, поведение пайпа не меняется (`return result.data as unknown`).
- [ ] Unit-тест пайпа — перенесён в волну тестов backend (вместе с T-043).
- [x] `pnpm --filter @costumes/backend lint` без ошибок по пайпу.

## Результат

Закрыта как дубль: исправление пришло из `d7c63d0` (ветка `chore/deploy-hardening`). Unit-тест пайпа (`zod-validation.pipe.spec.ts`: валидное тело, 400 `Validation failed` с `errors`, значения без статической `schema` проходят без изменений) выполняется вместе с T-043.

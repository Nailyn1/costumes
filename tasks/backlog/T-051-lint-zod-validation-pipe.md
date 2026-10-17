# T-051 · ESLint: `no-unsafe-return` в `zod-validation.pipe.ts`

- **Приоритет:** low
- **Область:** Техдолг
- **Создана:** 2026-10-17

## Контекст

Найдено при T-040: `pnpm --filter @costumes/backend lint` падает на `apps/backend/src/common/pipes/zod-validation.pipe.ts:34` (`@typescript-eslint/no-unsafe-return`, возврат значения типа `any`). Ошибка существовала до тестов. Пайп валидирует весь вход API, поэтому чинить аккуратно и с тестом (`zod-validation.pipe.spec.ts`: валидное тело, 400 `Validation failed` с `errors`, значения без статической `schema` проходят без изменений).

Стратегия, структура и образцы — [testing.md](../../.agents/testing.md). Бизнес-правила — [domain.md](../../.agents/domain.md). Баги из domain.md §6 не чиним: поведение, которое владелец признал багом, фиксируем `it.todo` со ссылкой на задачу (T-024…T-029).

## Критерии готовности

- [ ] Типизация возврата без `any` (`unknown` + type guard), поведение пайпа не меняется.
- [ ] Unit-тест пайпа.
- [ ] `pnpm --filter @costumes/backend lint` без ошибок.
- [ ] `pnpm test` зелёные, typecheck и lint без новых ошибок.

## План

<!-- заполняется при взятии в работу -->

## Результат

<!-- заполняется при завершении: что сделано, коммит/PR -->

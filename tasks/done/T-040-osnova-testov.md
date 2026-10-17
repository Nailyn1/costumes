# T-040 · Основа тестов: структура, инфраструктура, образцовые тесты

- **Приоритет:** high
- **Область:** Тесты
- **Создана:** 2026-10-17
- **Выполнена:** 2026-10-17

## Контекст

Перед мажорными обновлениями зависимостей ([T-019](../backlog/T-019-obnovlenie-zavisimostey.md): NestJS 12, Mantine 9) нужны тесты, фиксирующие поведение. До задачи был один spec (`visit-order.service.spec.ts`, 18 unit-тестов). Задача закладывает единую структуру; покрытие модулей — отдельные задачи T-041…T-049. Частично закрывает [T-017](../backlog/T-017-testy-biznes-logiki.md).

## Критерии готовности

- [x] [`.agents/testing.md`](../../.agents/testing.md): стратегия, соглашения, команды.
- [x] Backend unit: общий мок Prisma (с `$transaction`) и фабрики в `apps/backend/src/test-utils/`; `visit-order.service.spec.ts` переведён на них (те же 18 тестов).
- [x] Backend integration: `apps/backend/test/`, настоящий `AppModule` + supertest, БД `costumes_test`, Redis db 15, очередь и Green-API замоканы.
- [x] Frontend: Vitest + Testing Library + jsdom + MSW; `test/setup.ts`, `test/render.tsx`, `test/server.ts`.
- [x] Скрипты: backend `test` / `test:int` / `test:db:reset` / `typecheck`, frontend `test`, корень `test` / `test:int`.
- [x] Образцы: `search.utils.spec.ts` (+ «Арина» vs «Марина», `it.todo` T-034), `visit-flow.int-spec.ts` (логин → … → возврат), `orderTotals.test.ts`, `useClients.test.tsx`, `clientSearchField.test.tsx` (клиент из ЧС недоступен).
- [x] DoD в `workflow.md`, ссылка на testing.md в `AGENTS.md`.
- [x] Задачи на покрытие модулей: T-041…T-049; найденное — T-050, T-051.

## План

Backend unit → backend integration → frontend → документация и задачи. Коммиты по шагам, без push и merge.

## Результат

Коммиты в ветке `claude/foundation-6ef896` (без push/merge):
- `test(back)`: общий мок Prisma, фабрики, `search.utils.spec.ts`;
- `test(back)`: инфраструктура и сценарий integration;
- `refactor(front)`: вынос `calcOrderTotals` (поведение не менялось);
- `test(front)`: Vitest/RTL/MSW и образцы;
- `docs(root)`: testing.md, workflow, setup, AGENTS;
- `docs(root)`: задачи T-040…T-051.

Решения и отклонения:
- `test:int` готовит БД через `prisma migrate deploy` (создаёт `costumes_test`, накатывает миграции, данные не трогает); полный `migrate reset --force` вынесен в `test:db:reset`, потому что Prisma блокирует эту команду при запуске из AI-агента без явного согласия владельца.
- Bull-очередь и её процессор заменены заглушками (Worker иначе читал бы настоящую очередь dev-Redis db 0; `QueueModule` не умеет выбирать db). Production-код не менялся.
- ts-jest работает с `isolatedModules` (`tsconfig.jest.json`), типы тестов проверяет `pnpm --filter @costumes/backend typecheck`.
- Найдено: дефолтное время по дню недели из domain.md не реализовано (T-050); lint-ошибка в `zod-validation.pipe.ts` (T-051).

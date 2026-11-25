# T-116 · Prettier-ошибки в redis/idempotency

- **Приоритет:** low
- **Область:** Техдолг
- **Создана:** 2026-10-25
- **Выполнена:** 2026-11-25

## Контекст

`pnpm --filter @costumes/backend lint` стабильно падает на 5 ошибках `prettier/prettier` в `apps/backend/src/redis/redis.idempotency.ts` и `redis.idempotency.spec.ts`, не связанных с текущими задачами (найдено при T-109/T-110). Из-за них нельзя получить «чистый» lint для DoD без исключений.

## Критерии готовности

- [x] `pnpm --filter @costumes/backend lint` проходит без ошибок.
- [x] Изменено только форматирование (поведение и тесты не меняются).

## План

Применить ESLint --fix только к двум redis.idempotency-файлам, проверить diff, общий backend lint/typecheck и тесты. Отдельный коммит без push.

## Результат

Исправлены переносы вызова ConflictException и цепочек jest.fn().mockResolvedValue в двух файлах. Структура TypeScript AST до и после совпадает: логика и тестовые ожидания не изменены.

Проверки: backend lint и typecheck (включая test/) прошли; pnpm test — 421 backend + 236 frontend; pnpm test:int — 101 тест. Integration выполнены в локальных временных PostgreSQL costumes_test:5433 и Redis:6380 (db 15), production и VPS не затрагивались. Известный lint-блокер релизного CI устранён.

# T-021 · Выдавать только `reserved` визиты

- **Приоритет:** high — до сезона обязательно
- **Область:** Баги домена (подтверждены владельцем, см. domain.md §6)
- **Создана:** 2026-10-15
- **Выполнена:** 2026-10-15

## Контекст

`visitIssue` сейчас позволяет выдать `cancelled`/`completed`.

## Критерии готовности

- [x] `visitIssue` выдаёт только визит в статусе `reserved`.
- [x] Для `issued`, `completed`, `cancelled` — `BadRequestException` со своим русским текстом на каждый статус.
- [x] Unit-тест на все четыре статуса.

## Результат

`visitIssue` (`apps/backend/src/visit-order/visit-order.sevice.ts`) вместо проверки «не `issued`» требует `status === 'reserved'`; тексты отказа лежат в `VISIT_ISSUE_REJECT_MESSAGES` (Record по оставшимся статусам, поэтому добавление нового статуса визита не скомпилируется без текста). Проверка идёт внутри транзакции до любых записей. Добавлен `visit-order.service.spec.ts` (Prisma и PrismaService замоканы через `jest.mock`, т.к. jest без `moduleNameMapper` не резолвит `.js`-импорты сгенерированного клиента). Из `domain.md` §6 убран пункт про `visitIssue`. Коммит — в ветке `claude/visit-guards-b6c19d`.

# T-037 · `createVisit` и `visitIssue` не фильтруют `deletedAt`

- **Приоритет:** medium
- **Область:** Баги домена
- **Создана:** 2026-10-15

## Контекст

Найдено при T-022. Нарушение правила «soft delete + фильтр `deletedAt: null` во всех выборках» ([domain.md](../../.agents/domain.md) §3.8):

- `createVisit` (`apps/backend/src/visit-order/visit-order.sevice.ts`) читает клиента через `tx.client.findUnique({ where: { id } })` без `deletedAt: null` — можно создать визит на удалённого клиента (прямым запросом к API; в UI удалённый клиент в поиске не появляется). Аналогично не проверяются удалённые ребёнок и костюм в `orders[]` (`isSuitAvailability` тоже не смотрит на `costume.deletedAt`).
- `visitIssue`, `visitUnissue` и др. читают визит через `findUnique` без `deletedAt: null`.

## Критерии готовности

- [ ] `createVisit` отклоняет удалённого клиента, ребёнка и костюм (понятная русская ошибка).
- [ ] `visitIssue` / `visitUnissue` / `visitCancel` / возврат не работают с удалёнными визитами.
- [ ] Unit-тесты.

## План

<!-- заполняется при взятии в работу -->

## Результат

<!-- заполняется при завершении -->

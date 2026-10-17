# T-041 · Тесты backend: visit-order (визиты, заказы, выдача, возврат)

- **Приоритет:** high
- **Область:** Тесты
- **Создана:** 2026-10-17

## Контекст

Главный модуль, через него проходят деньги и костюмы (`apps/backend/src/visit-order/visit-order.sevice.ts`). Сейчас покрыты только soft delete и валидация связей в `createVisit`/`visitIssue` (18 unit-тестов, T-037/T-022). Нужно покрыть остальные правила [domain.md](../../.agents/domain.md) §2–§3.

Стратегия, структура и образцы — [testing.md](../../.agents/testing.md). Бизнес-правила — [domain.md](../../.agents/domain.md). Баги из domain.md §6 не чиним: поведение, которое владелец признал багом, фиксируем `it.todo` со ссылкой на задачу (T-024…T-029).

## Критерии готовности

- [ ] **Бронь (`createVisit`):** `prepaymentAmount > rentPrice` → 400 (граница `=` проходит); `startDateTime > endDateTime` → 400; код визита без резерва в Redis → 409, после создания ключ `visit_code_lock:{code}` удаляется; склейка даты и времени в UTC «как есть» (`2026-12-20` + `18:30` → `2026-12-20T18:30:00Z`); `sendNotification=true` создаёт Notification `pending` и job `send-whatsapp` с `jobId=notification-{id}`, `false` — нет; сбой очереди не откатывает создание визита; ошибка `P2003` обрабатывается.
- [ ] **Занятость (`isSuitAvailability`):** пересечение `start < otherEnd && end > otherStart` (границы: встык = свободно, перекрытие на минуту = занято); отменённые и удалённые заказы не блокируют; возвращённые заказы блокируют (известный баг T-024 — `it.todo`); два заказа с одним костюмом в одном запросе.
- [ ] **Генерация кода (`generatePreviewCode`):** 4 цифры, пропуск занятых в Redis и в БД, исчерпание попыток → 500, резерв с TTL 15 мин.
- [ ] **Бирка (`orderMarkTagWritten`):** `not_written → written`; несуществующий/удалённый заказ → 404; список `findOrdersNotWritten` не содержит отменённых, возвращённых и заказов закрытых/отменённых визитов.
- [ ] **Выдача (`visitIssue`):** выдать можно только `reserved` (остальные статусы — 400 с понятным текстом); все заказы и визит → `issued`; доплата раскладывается по заказам в `finalPayment` (сумма раскладки = доплата; поведение при недоплате/переплате — T-028, `it.todo`); Deposit создаётся (`cash` с суммой, `document`, `none`), `returned=false`; атомарность — при ошибке ничего не записано; `visit.notes` дописывается.
- [ ] **Отмена выдачи (`visitUnissue`):** `issued → reserved`, заказы → `reserved`, `finalPayment` сбрасывается; не `issued` → 400; физическое удаление Deposit — известный баг T-026 (`it.todo`).
- [ ] **Отмена визита (`visitCancel`):** только из `reserved`; заказы → `cancelled`; костюм снова доступен для новой брони (integration).
- [ ] **Возврат (`visitCompleteReturn`):** только `issued`; заказы → `returned`, визит → `completed`; `depositReturned` ставит `Deposit.returned`; комментарий дописывается с префиксом `[Завершение]:`; залог не блокирует закрытие; частичный возврат невозможен (T-027, `it.todo`).
- [ ] **Залог (`MarkDepositReturned`):** только для `completed` с `type≠none`; повторная отметка; комментарий.
- [ ] **Выборки:** `visitReserved` (фильтр по датам, пагинация `{items,total,page,limit,hasMore}`), `visitsIssuedForReturn`, `visitSearch` / `visitsReturnSearch` (код, ребёнок, костюм, inventoryCode, телефон; минимум 2 символа), `visitsUnreturnedDeposits`; везде фильтр `deletedAt: null`, в т.ч. вложенные `orders` (остаток — T-038).
- [ ] Integration (`apps/backend/test/`): сценарии «отмена → костюм снова свободен», «выдача → отмена выдачи → повторная выдача», «возврат с залогом cash → отметка залога», конфликт брони на пересекающиеся даты (базовый сценарий уже есть в `visit-flow.int-spec.ts`).
- [ ] `pnpm test` и `pnpm test:int` зелёные, typecheck и lint без новых ошибок.

## План

<!-- заполняется при взятии в работу -->

## Результат

<!-- заполняется при завершении: что сделано, коммит/PR -->

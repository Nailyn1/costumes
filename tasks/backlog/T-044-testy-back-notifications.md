# T-044 · Тесты backend: notifications (WhatsApp, вебхуки, статусы)

- **Приоритет:** medium
- **Область:** Тесты
- **Создана:** 2026-10-17

## Контекст

`apps/backend/src/notification/`: сервис, процессор BullMQ, провайдер Green-API, вебхук ([domain.md](../../.agents/domain.md) §2, §5). Реальной отправки в тестах нет — провайдер и очередь замоканы; тестового инстанса Green-API пока нет (T-014).

Стратегия, структура и образцы — [testing.md](../../.agents/testing.md). Бизнес-правила — [domain.md](../../.agents/domain.md). Баги из domain.md §6 не чиним: поведение, которое владелец признал багом, фиксируем `it.todo` со ссылкой на задачу (T-024…T-029).

## Критерии готовности

- [ ] **Приоритет статусов:** `failed(0) < pending(1) < sent(2) < delivered(3) < read(4) < isConfirmed(5) < noAccount(6)` — переход вниз игнорируется, вверх применяется, равный — нет-оп; таблица `it.each` по всем парам.
- [ ] **Вебхук `outgoingMessageStatus`:** обновление по `externalId`, неизвестный id — без ошибки, пуш на фронт через gateway (`notification_status_updated`).
- [ ] **`incomingMessageReceived`:** ответ клиента → последнее уведомление этого телефона за 48 ч → `isConfirmed`; старше 48 ч — не трогаем; несколько уведомлений — только последнее; телефон нормализуется (`+7…` ↔ `7…@c.us`).
- [ ] **`stateInstanceChanged`:** статус инстанса пишется в Redis `whatsapp:instance:{id}:status`; `isInstanceAuthorized` читает его.
- [ ] **Процессор:** инстанс не авторизован → job падает (ретрай); `send-whatsapp` вызывает `processWhatsAppSending`; неизвестное имя job — игнор.
- [ ] **`processWhatsAppSending`:** успех → `sent` + `externalId`; ошибка провайдера → `failed` + `errorText`; нет WhatsApp у номера → `noAccount`; повторная отправка (`resend`, `update_phone_and_resend`) обновляет телефон и переотправляет.
- [ ] **`buildVisitMessage`** (`common/utils/visit-message.utils.ts`): код выдачи, дети и костюмы с суммами, итоги, график выдачи/возврата, условия (залог от 5 000 ₸, предоплата не возвращается) — проверять ключевые фрагменты, не весь текст.
- [ ] **Безопасность вебхука:** текущее поведение без проверки токена фиксируем отдельным `it.todo` со ссылкой на T-030.
- [ ] **Список уведомлений** (`/visits/notification`, `notification-search`): пагинация, поиск, счётчик «сегодня».
- [ ] `pnpm test` и `pnpm test:int` зелёные, typecheck и lint без новых ошибок.

## План

<!-- заполняется при взятии в работу -->

## Результат

<!-- заполняется при завершении: что сделано, коммит/PR -->

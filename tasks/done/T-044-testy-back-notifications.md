# T-044 · Тесты backend: notifications (WhatsApp, вебхуки, статусы)

- **Приоритет:** medium
- **Область:** Тесты
- **Создана:** 2026-10-17
- **Выполнена:** 2026-10-17

## Контекст

`apps/backend/src/notification/`: сервис, процессор BullMQ, провайдер Green-API, вебхук ([domain.md](../../.agents/domain.md) §2, §5). Реальной отправки в тестах нет — провайдер и очередь замоканы; тестового инстанса Green-API пока нет (T-014).

Стратегия, структура и образцы — [testing.md](../../.agents/testing.md). Бизнес-правила — [domain.md](../../.agents/domain.md). Баги из domain.md §6 не чиним: поведение, которое владелец признал багом, фиксируем `it.todo` со ссылкой на задачу (T-024…T-029).

## Критерии готовности

- [x] **Приоритет статусов:** `failed(0) < pending(1) < sent(2) < delivered(3) < read(4) < isConfirmed(5) < noAccount(6)` — переход вниз игнорируется, вверх применяется, равный — нет-оп; таблица `it.each` по всем парам.
- [x] **Вебхук `outgoingMessageStatus`:** обновление по `externalId`, неизвестный id — без ошибки, пуш на фронт через gateway (`notification_status_updated`).
- [x] **`incomingMessageReceived`:** ответ клиента → последнее уведомление этого телефона за 48 ч → `isConfirmed`; старше 48 ч — не трогаем; несколько уведомлений — только последнее; телефон нормализуется (`+7…` ↔ `7…@c.us`).
- [x] **`stateInstanceChanged`:** статус инстанса пишется в Redis `whatsapp:instance:{id}:status`; `isInstanceAuthorized` читает его.
- [x] **Процессор:** инстанс не авторизован → job падает (ретрай); `send-whatsapp` вызывает `processWhatsAppSending`; неизвестное имя job — игнор.
- [~] **`processWhatsAppSending`:** успех → `sent` + `externalId`; ошибка провайдера → `failed` + `errorText`; нет WhatsApp у номера → `noAccount`; повторная отправка (`resend`, `update_phone_and_resend`) обновляет телефон и переотправляет.
- [x] **`buildVisitMessage`** (`common/utils/visit-message.utils.ts`): код выдачи, дети и костюмы с суммами, итоги, график выдачи/возврата, условия (залог от 5 000 ₸, предоплата не возвращается) — проверять ключевые фрагменты, не весь текст.
- [x] **Безопасность вебхука:** текущее поведение без проверки токена фиксируем отдельным `it.todo` со ссылкой на T-030.
- [ ] **Список уведомлений** (`/visits/notification`, `notification-search`): пагинация, поиск, счётчик «сегодня».
- [x] `pnpm test` и `pnpm test:int` зелёные, typecheck и lint без новых ошибок.

## План

<!-- заполняется при взятии в работу -->

## Результат

Добавлены 4 spec-файла в `apps/backend/src/notification/`: `notification.service.spec.ts` (приоритет статусов — `it.each` по всем 49 парам, подтверждение ответом за 48 ч, `handleInstanceStateChange`, `isInstanceAuthorized`, `processWhatsAppSending`, повторная отправка, смена телефона), `notification.processor.spec.ts`, `notification.controller.spec.ts` (маршрутизация вебхуков по типам, `it.todo` на T-030), `visit-message.spec.ts` (`buildVisitMessage` из `common/utils`). Green-API, Redis, очередь, gateway — моки.

Не покрыто (отмечено `[~]`/`[ ]`):
- `noAccount` при отсутствии WhatsApp у номера: статус нигде не выставляется — `it.todo`, задача [T-054](../backlog/T-054-status-noaccount-ne-vystavlyaetsya.md).
- Список уведомлений (`/visits/notification`, `notification-search`) живёт в `visit-order` — зона другого агента, не покрыт.
- Найдено: `NotificationService` отправляет текст из приватной копии `buildVisitMessage`, расходящейся с `common/utils` — [T-053](../backlog/T-053-dubl-buildvisitmessage.md).

# T-053 · Дубль `buildVisitMessage` в NotificationService

- **Приоритет:** low
- **Область:** Инфраструктура и гигиена репозитория
- **Создана:** 2026-10-17

## Контекст

`NotificationService.buildVisitMessage` (приватный, `notification.service.ts`) — копия `common/utils/visit-message.utils.ts`, отличающаяся отступом в строке «Цена» (3 пробела против 2). `processWhatsAppSending` (BullMQ) использует приватную копию, а `visit-order.sevice.ts` — утилиту; тесты (T-044) покрывают только утилиту. Тексты могут разойтись.

## Критерии готовности

- [ ] `NotificationService` использует `buildVisitMessage` из `common/utils`, приватная копия удалена
- [ ] Выбран единый формат отступа (согласовать с владельцем)
- [ ] Тест на `processWhatsAppSending` проверяет текст из утилиты

## План

<!-- заполняется при взятии в работу -->

## Результат

<!-- заполняется при завершении: что сделано, коммит/PR -->

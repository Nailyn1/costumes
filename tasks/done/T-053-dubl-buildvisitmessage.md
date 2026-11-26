# T-053 · Дубль `buildVisitMessage` в NotificationService

- **Приоритет:** low
- **Область:** Инфраструктура и гигиена репозитория
- **Создана:** 2026-10-17
- **Выполнена:** 2026-10-19

## Контекст

`NotificationService.buildVisitMessage` была копией `common/utils/visit-message.utils.ts` с отличающимся отступом в строке «Цена». `processWhatsAppSending` использовал приватную копию, а `visit-order.service.ts` — общую утилиту.

## Критерии готовности

- [x] `NotificationService` использует `buildVisitMessage` из `common/utils`, приватная копия удалена.
- [x] Канонический формат сообщения — формат общей утилиты: два пробела перед «Цена».
- [x] Тест `processWhatsAppSending` проверяет строку позиции с каноническим отступом.

## План

Использовать общую утилиту из сервиса, убрать дубликат, синхронизировать проверки формата и прогнать unit-тесты, typecheck и lint backend.

## Результат

Сервис использует общую утилиту; приватный форматтер удалён, проверки формата синхронизированы. Финальная проверка 2026-10-20 в `set-agent`: `pnpm test` — backend 15 наборов / 262 passed, frontend 14 файлов / 124 passed; `pnpm test:int` — 7 наборов / 33 passed. Сборка `shared`, typecheck backend/frontend и lint прошли.

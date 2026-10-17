# T-054 · Статус `noAccount` нигде не выставляется

- **Приоритет:** low
- **Область:** Баги домена
- **Создана:** 2026-10-17

## Контекст

В `STATUS_PRIORITY` (`notification.service.ts`) и enum `NotificationStatus` есть `noAccount` (у номера нет WhatsApp), но `WhatsappProvider.sendMessage` не проверяет наличие аккаунта (`checkWhatsapp` Green-API), а `processWhatsAppSending` при любой ошибке ставит `failed`. Статус может прийти только вебхуком. Уточнить у владельца, нужен ли он (и поведение фронта).

## Критерии готовности

- [ ] Решение владельца: реализовать проверку `checkWhatsapp` или убрать статус
- [ ] Тест вместо `it.todo` в `notification.service.spec.ts`

## План

<!-- заполняется при взятии в работу -->

## Результат

<!-- заполняется при завершении: что сделано, коммит/PR -->

# T-013 · Объединить `GREEN_API_ID_INSTANCE` и `INSTANCE_ID`

- **Приоритет:** medium — желательно до сезона
- **Область:** Инфраструктура и гигиена репозитория
- **Создана:** 2026-10-15
- **Выполнена:** 2026-10-17

## Контекст

Статус инстанса писался по ключу `whatsapp:instance:{GREEN_API_ID_INSTANCE}:status` (`syncWhatsappStatus`; вебхук `stateInstanceChanged` — по `instanceData.idInstance` из тела), а читался `isInstanceAuthorized` по `INSTANCE_ID`. При разных значениях процессор считал бы инстанс неавторизованным и все job'ы уходили бы в ретраи.

## Критерии готовности

- [x] Тест, воспроизводящий баг (красный до фикса): `isInstanceAuthorized` читает ключ, записанный `syncWhatsappStatus`
- [x] Остаётся одна переменная `GREEN_API_ID_INSTANCE`; `INSTANCE_ID` удалена из кода и из `.env.example` (корень, backend, `.env.test.example`)
- [x] `.agents/setup.md` §2 обновлён

## План

—

## Результат

`isInstanceAuthorized` читает `GREEN_API_ID_INSTANCE`; `INSTANCE_ID` убрана из примеров env. Регрессионный тест — в `notification.service.spec.ts`. **На сервере:** убедиться, что `GREEN_API_ID_INSTANCE` в `.env` задан (он и так нужен для отправки); `INSTANCE_ID` можно удалить. Коммит — в ветке `claude/notifications-security-6b8030`.

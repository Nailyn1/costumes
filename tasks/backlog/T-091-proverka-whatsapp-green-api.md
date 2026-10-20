# T-091 · Проверка WhatsApp через Green-API

- **Приоритет:** low — отложено по решению владельца
- **Область:** Фичи и инфраструктура
- **Создана:** 2026-10-20
- **Заменяет:** T-014 и T-054

## Контекст

При выборе или создании клиента в бронировании сотрудник должен видеть, найден ли WhatsApp на его номере. Сейчас `WhatsappProvider` умеет отправлять сообщение, но не вызывает `checkWhatsapp`; `noAccount` может прийти только через вебхук. Для локальной разработки нужен отдельный тестовый инстанс Green-API. Отсутствие WhatsApp и ошибка проверки не блокируют создание визита.

## Критерии готовности

- [ ] Локальные реквизиты тестового инстанса хранятся только в игнорируемом `.env`; приоритет корневого и backend `.env` однозначно определён и описан.
- [ ] Backend вызывает Green-API `checkWhatsapp` для номера `+7XXXXXXXXXX`, различает `exists`, `absent`, `unknown` (ошибка или недоступность), ограничивает повторные проверки кэшем и позволяет перепроверить вручную.
- [ ] Проверка выполняется при выборе/создании клиента в форме брони и после изменения номера; результат и понятное сообщение показаны в карточке клиента и окне «Проверка данных визита».
- [ ] При `absent` сотруднику предлагается исправить номер или сообщить код выдачи клиенту лично. Визит создаётся и без WhatsApp; отправка сообщения для подтверждённого `absent` выключена.
- [ ] При `unknown` показывается «Не удалось проверить», визит можно создать, ошибка не трактуется как отсутствие WhatsApp.
- [ ] Перед отправкой из очереди backend повторно учитывает актуальный номер и статус. Подтверждённое отсутствие ставит Notification в `noAccount` без повторов; временная ошибка остаётся повторяемой. Тест вместо `it.todo` в `notification.service.spec.ts`.
- [ ] Секреты и номера клиентов не попадают в логи и репозиторий; контракт, unit/integration/frontend тесты и `.agents` обновлены.

## План и файлы

1. Конфигурация тестового инстанса и загрузки env: `apps/backend/.env.example`, `apps/backend/src/app.module.ts`, `.agents/setup.md`. Реальные ключи записывает владелец в игнорируемый `apps/backend/.env`.
2. Проверка и состояние на backend: `apps/backend/src/notification/whatsapp.provider.ts`, `apps/backend/src/notification/notification.service.ts`, `apps/backend/src/client-child/clients.controller.ts`, `apps/backend/src/client-child/client-child.service.ts`; соответствующие `*.spec.ts` и integration-тест в `apps/backend/test/`.
3. Контракт: `shared/api-spec/modules/clients.tsp`, `shared/src/schemas.ts`, `shared/src/children-client.ts` (проверить фактический файл экспорта при реализации), генерация `shared/src/openapi-client.ts` и `shared/src/openapi-client.types.d.ts`.
4. UI: `apps/crm-frontend/src/features/clients-children/components/clients/clientSelector.tsx`, `selectedClientCard.tsx`, клиентские service/hook, `apps/crm-frontend/src/features/visits/components/VisitPreviewModal.tsx`, тесты `CreateBookingPage.test.tsx` и компонента клиента.
5. Обновить `.agents/domain.md` и описание состояния уведомлений.

## Результат

Отложено по решению владельца 2026-10-20.

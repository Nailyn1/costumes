# T-091 · Проверка WhatsApp через Green-API

- **Приоритет:** medium — в работе по решению владельца
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

Возобновлено по решению владельца. Реквизиты тестового инстанса добавлены в локальный `apps/backend/.env`; интеграция проверена на моках. Первые прямые вызовы `checkWhatsapp` с согласованным тестовым номером 2026-10-20 возвращали HTTP 400. После перезапуска инстанса владельцем повторный вызов вернул HTTP 200, `existsWhatsapp: true`, `fromCache: false`: живой метод подтвердил WhatsApp на тестовом номере. Сообщение не отправлялось. Локальная проверка без раскрытия секретов показала: API-хост и префикс ID инстанса совпадают (`7103`), корневой и backend `.env` содержат одинаковые реквизиты. Ранее Redis хранил состояние инстанса `unknown`; при следующем запуске backend нужно проверить, обновится ли оно до `authorized`. Для входящих вебхуков ngrok должен направлять запросы на backend порт 5000 с путём `/webhooks/whatsapp`.

## Доработка по решению владельца 2026-10-20

- [x] При `exists` скрыть кнопку «Проверить повторно»; при `absent`/`unknown` оставить возможность ручной проверки.
- [x] Если на **текущий** номер клиента уже есть подтверждённое уведомление, сразу показать «WhatsApp есть» из данных клиента и не вызывать `checkWhatsapp`. Доказательство — только `delivered`, `read` или `isConfirmed`; одного `sent` недостаточно.
- [x] У старых Notification нет сохранённого номера получателя. Для них считать доказательством лишь запись, созданную после последнего изменения Client (`client.updatedAt <= notification.createdAt`); при сомнении выполнять обычную проверку. Смена телефона сбрасывает прежнее доказательство.
- [x] Добавить признак подтверждённого WhatsApp в TypeSpec-ответ клиента и перегенерировать shared-клиент; обновить поиск/детали клиента, выбор клиента и превью визита.
- [x] Перенести проверку из `whatsapp-availability.service.ts` в `notification.service.ts`; выделить узкий `notification.repository.ts` для запросов Prisma уведомлений. Это осознанное исключение из прежнего правила backend без репозиториев — отразить в `.agents/backend.md`.
- [x] Unit-тесты модуля notification расположить в `apps/backend/src/notification/tests/`; integration-тесты остаются в `apps/backend/test/` по конфигурации Jest.

План файлов: `shared/api-spec/modules/clients.tsp`, generated и ручные экспорты `shared/src/`; `apps/backend/src/notification/{notification.service.ts,notification.repository.ts,notification.module.ts,tests/}`, `apps/backend/src/client-child/{client-child.service.ts,clients.controller.ts}`; `apps/crm-frontend/src/features/clients-children/{hooks,services,components,types}/`, `apps/crm-frontend/src/features/visits/components/VisitPreviewModal.tsx`; профильные тесты и `.agents/{domain,backend,architecture}.md`.

Результат проверки до ручной приёмки: сборка shared и frontend, backend typecheck, lint обоих приложений, backend unit (283 пройдено), backend integration (35 пройдено), frontend unit (132 пройдено), `git diff --check` — успешно. Изменения не закоммичены. Историческое подтверждение консервативно сбрасывается также после изменения имени клиента, поскольку Notification не хранит номер получателя.

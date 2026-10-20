# T-020 · Замена Zodios / openapi-zod-client на typed-openapi

- **Приоритет:** low — после T-019
- **Область:** Зависимости
- **Создана:** 2026-10-15
- **Выполнена:** 2026-10-20

## Контекст

Проекты фактически не поддерживаются и держат Zod на v3. Владелец согласовал переход на typed-openapi и Zod 4 после T-019: этот генератор поддерживает встроенную валидацию запросов и ответов. Сохраняем контракт TypeSpec → OpenAPI → `shared` и существующие React Query-хуки. На фронтенде сейчас используется общий Axios instance с cookie, токеном, обновлением авторизации и ключом идемпотентности; эти свойства должны сохраниться.

## Критерии готовности

- [x] `shared` генерирует Zod 4-схемы и типизированный клиент через typed-openapi из существующего OpenAPI; `openapi-zod-client` и `@zodios/core` удалены.
- [x] Ручные экспорты из `shared` и backend DTO работают с новыми схемами; генерация воспроизводима.
- [x] Frontend-сервисы используют новый клиент через существующий Axios instance. Сохраняются cookie, авторизация и refresh/retry, ключ идемпотентности и обработка Axios-ошибок. Ручные React Query-хуки остаются рабочими.
- [x] Сравнена валидация запросов и ответов с прежним клиентом; обнаруженные расхождения покрыты тестами и устранены без ослабления проверки.
- [x] Обновлены `.agents` инструкции; проходят сборка, typecheck, lint, unit- и integration-тесты.

## План

После T-019 настроить typed-openapi на текущий OpenAPI с Zod 4 и `validateSide: 'both'`, проверить форму сгенерированных схем и клиента, перевести экспорты `shared` и frontend-сервисы, затем поднять Zod до 4 и проверить DTO/формы. Для HTTP использовать существующий Axios instance; отдельно проверить прежнюю семантику валидации и передачи неизвестных полей. После каждого шага запускать профильные проверки.

## Результат

### Найденные расхождения контракта

- `Common.Error` раньше описывал `{ code, message }`, тогда как Nest и Prisma exception filter фактически возвращают `{ statusCode, message, error?, ... }`. Исправлено в TypeSpec; generated schemas сохраняют дополнительные поля.
- `search-available` в UI отправляет даты с временем (`YYYY-MM-DDTHH:mm`), backend разбирает их через `new Date()`, но TypeSpec требовал `plainDate`. Исправлено на строки и покрыто тестом, который проверяет, что datetime проходит request validation и попадает в HTTP query.
- Несколько MSW тестов использовали 200/201 для операций, где Nest controller возвращает 204; исправлены только после сверки соответствующих контроллеров.

### Реализация и проверки

- В `shared` настроен воспроизводимый TypeSpec → OpenAPI 3.1 → typed-openapi pipeline (`validateSide: "both"`, Zod 4, `additionalPropertiesDefault: true`, форматирование generated-файлов). Для прежнего API `schemas.*` добавлен ручной совместимый экспорт; generated named schemas и CJS declarations собираются в `dist`.
- Все frontend services переведены на typed client поверх Axios singleton. Adapter сохраняет `withCredentials`, interceptors, query serialization, статусные тела ошибок и 204; относительный `/api` нормализуется в абсолютный URL для `new URL()` без повторения API prefix. Ошибки после неуспешного refresh остаются AxiosError.
- Формы используют Mantine 9 `schemaResolver`; обновлены Zod 4 diagnostics и backend validation error envelope.
- Исправлены расхождения TypeSpec: Nest возвращает `statusCode/message/error?`, а поиск доступности получает даты со временем (`YYYY-MM-DDTHH:mm`). Изменения покрыты adapter regression tests. MSW fixture статусы сверены с backend controllers.
- `gen:api` запущена дважды: generated `.ts` и `.d.ts` hashes совпали.
- Проверки: shared/backend/frontend builds и lint прошли; `pnpm test` — backend 15 suites / 262 passed (5 todo), frontend 14 files / 124 passed (1 todo); `git diff --check` чистый.
- `pnpm test:int` — 7 наборов, 33 теста прошли 2026-10-20 на отдельной `costumes_test` после переноса изменений в `set-agent`.

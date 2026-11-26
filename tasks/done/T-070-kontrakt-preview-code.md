# T-070 · Контракт `preview-code` расходится с бэкендом

- **Приоритет:** medium
- **Область:** Баги домена
- **Создана:** 2026-10-17
- **Выполнена:** 2026-10-18

## Контекст

Найдено при T-046. TypeSpec (`shared/api-spec/modules/visits.tsp`, `previewCode`) и сгенерированный клиент описывают ответ `POST /visits/preview-code` как объект `{ visitCode }`, а бэкенд (`visits.controller.ts` `PreviewCode(): Promise<string>`) отдаёт голую строку (`text/html`, `"1648"`; integration-тест читает `res.text`). Форма брони работает только потому, что `VisitSummaryPanel` делает `String(code)`: ответ в формате контракта превратил бы код в `[object Object]` (проверено в тесте). Нужно выровнять контракт и реализацию (обычно проще поправить TypeSpec на `string`/`@body`), затем поправить `VisitSummaryPanel`. Затрагивает `shared/` и backend — отдельная задача, не чинилась в T-046.

## Критерии готовности

- [x] Ответ приведён к единому контракту: JSON-строка с четырёхзначным кодом.
- [x] Фронт читает код без `String(...)`-костыля; тест `it.todo` в `CreateBookingPage.test.tsx` (T-070) превращён в тест.
- [x] Эквивалентные локальные запуски полного unit и integration набора, typecheck и lint зелёные (`pnpm` не запускается в среде из-за EPERM).

## План

1. Описать JSON-строку в TypeSpec, перегенерировать клиент и собрать `shared`.
2. Вернуть JSON-строку из backend, передавать типизированный код во фронт без преобразования.
3. Обновить тесты backend/frontend и выполнить проверки.

## Результат

Коммит: `2896f39`.

TypeSpec и клиент теперь ожидают `string` по шаблону `^\d{4}$`; backend отвечает JSON-строкой с `Content-Type: application/json`. Прежний frontend остаётся совместим: его `String(code)` получает ту же строку. Убран `String(code)` из `VisitSummaryPanel`, заменён T-070 `it.todo` на исполняемый тест. Integration-тесты, читавшие необработанный `.text`, переведены на JSON `.body`.

Проверено: `shared` build, backend/frontend typecheck и lint; backend unit — 258 passed / 8 todo, integration — 33 passed, frontend `vitest run` — 117 passed / 5 todo. Лимит времени frontend-тестов стабилизирован в T-088. Изменения не коммичены.

# T-010 · Опечатки в именах файлов

- **Приоритет:** low — потом
- **Область:** Инфраструктура и гигиена репозитория
- **Создана:** 2026-10-15
- **Выполнена:** 2026-10-18

## Контекст

`visit-order.sevice.ts`, `clients.service..ts`, `utills/`, `IsuueModal.tsx`, `seacrh.dto.ts`, `visitIssuedRepsonseDto` и т.п.

## Критерии готовности

- [x] Переименованы перечисленные файлы и папка `utills/`, обновлены все импорты.
- [x] Исправлено написание `visitIssuedRepsonseDto` в ручном экспорте shared и потребителях.
- [x] Typecheck, lint, unit и integration проходят без изменения поведения.

## План

1. Переименовать файлы/папку и символ; обновить ссылки в активной документации.
2. Проверить отсутствие старых имён в коде и выполнить полные проверки.

## Результат

Исправлены имена `visit-order.service.ts`, `search.dto.ts`, `clients.service.ts`, `IssueModal.tsx`, папка `utils/` и тип `visitIssuedResponseDto`. Импорты и активная документация обновлены; старых имён в `apps/`, `shared/`, `.agents/` больше нет. Проверки: shared build, backend/frontend typecheck и lint, backend unit 261 passed / 5 todo, frontend 118 passed / 1 todo, backend integration 33 passed.

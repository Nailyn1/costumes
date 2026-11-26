# T-011 · Удалить старые ветки

- **Приоритет:** low — потом
- **Область:** Инфраструктура и гигиена репозитория
- **Создана:** 2026-10-15
- **Выполнена:** 2026-10-18

## Контекст

`backend/*`, `frontend/changes`, `some_updates_for_production` (локально и на origin) после проверки, что всё влито.

## Критерии готовности

- [x] Все перечисленные старые ветки проверены как включённые в `origin/main`.
- [x] Локальные `backend/notifications` и `some_updates_for_production` удалены; остальные перечисленные локально отсутствовали.
- [x] Старые ветки удалены/уже отсутствовали на origin; `main` и `set-agent` сохранены.

## План

Обновить сведения об origin, проверить включение веток в `origin/main`, удалить только перечисленные ветки и подтвердить итоговый список.

## Результат

Коммит: `74bab1c`.

Пять старых веток (`backend/children`, `backend/clients`, `backend/logger`, `backend/notifications`, `frontend/changes`) уже отсутствовали на сервере, хотя локальные remote-tracking refs были устаревшими. Удалены две оставшиеся ветки origin: `backend/visit-order` и `some_updates_for_production`; локально удалены `backend/notifications` и `some_updates_for_production`. На origin остались `main` и `set-agent`.

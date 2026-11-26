# T-004 · `.env.example`

- **Приоритет:** high — до сезона обязательно
- **Область:** Инфраструктура и гигиена репозитория
- **Создана:** 2026-10-15
- **Выполнена:** 2026-10-15

## Контекст

шаблоны для `apps/backend/.env`, корневого `.env` и `apps/crm-frontend/.env.development` (без секретов).

## Критерии готовности

- [x] `apps/backend/.env.example` — все переменные из `.agents/setup.md` §2, плейсхолдеры
- [x] корневой `.env.example` — переменные для прод-`docker-compose.yaml`
- [x] `apps/crm-frontend/.env.development.example`
- [x] нет реальных секретов; шаблоны не попадают под `.gitignore`
- [x] `.agents/setup.md` ссылается на шаблоны вместо «шаблона нет»

## Результат

Добавлены три шаблона (значения — `change-me` / пустые / localhost). Список переменных взят из реальных `.env` (только имена, значения не копировались). В корневом шаблоне нет `REDIS_URL` и `USER*` — как в реальном корневом `.env`; `DATABASE_URL`/`REDIS_URL` внутри compose переопределяются в `docker-compose.yaml`.

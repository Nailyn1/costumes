# T-006 · `docker-compose.dev.yml` в git

- **Приоритет:** medium — желательно до сезона
- **Область:** Инфраструктура и гигиена репозитория
- **Создана:** 2026-10-15
- **Выполнена:** 2026-10-17

## Контекст

сейчас в `.gitignore`; вынести пароль в env и закоммитить, чтобы dev-окружение поднималось из репозитория. Убрать устаревший `version:`.

## Критерии готовности

- [x] Пользователь/пароль/БД вынесены в env с дефолтами
- [x] Устаревший `version:` убран
- [x] Файл убран из `.gitignore` и закоммичен
- [x] `.agents/setup.md` обновлён

## Результат

`docker-compose.dev.yml` теперь в git: `${POSTGRES_USER:-postgres}`, `${POSTGRES_PASSWORD:-123456}`, `${POSTGRES_DB:-costumes}`. Имена `dev-postgres`/`dev-redis` и volume `dev_postgres_data` не менялись. Проверено `docker compose -f docker-compose.dev.yml config` (дефолты и значения из корневого `.env` совпадают). Обновлены `.agents/setup.md` (§3, §6) и `architecture.md`.

# T-016 · Версионирование образов

- **Приоритет:** medium — желательно до сезона
- **Область:** CI/CD и качество
- **Создана:** 2026-10-15
- **Выполнена:** 2026-10-17

## Контекст

тег по git SHA вместо только `:latest` (возможность отката).

## Критерии готовности

- [x] Образы пушатся с тегом `${{ github.sha }}` и `latest`
- [x] Деплой на сервере подтягивает конкретный SHA (`IMAGE_TAG`)
- [x] Откат на предыдущий SHA описан в `.agents/architecture.md` §4

## Результат

`docker-compose.yaml`: `image: ...:${IMAGE_TAG:-latest}`. Workflow: сборка с `IMAGE_TAG=${{ github.sha }}`, push SHA-тега, затем `docker tag` + push `latest`; на сервере `export IMAGE_TAG=<sha>` перед `compose pull/up`. Проверено: `docker compose config` с и без `IMAGE_TAG`, локальная сборка с `IMAGE_TAG=testsha` (теги созданы, затем удалены), `actionlint` без замечаний. Не проверено: реальный push/деплой. Процедура отката — в `.agents/architecture.md` §4.

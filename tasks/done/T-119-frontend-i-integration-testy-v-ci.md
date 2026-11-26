# T-119 · Frontend и integration-тесты в CI перед деплоем

- **Приоритет:** high
- **Область:** CI/CD
- **Создана:** 2026-11-26
- **Выполнена:** 2026-11-26

## Контекст

Владелец запросил отдельный коммит с frontend- и integration-тестами в GitHub Actions. Сейчас check запускает только backend unit-тесты. Сборка образов и production-деплой должны зависеть от успешного завершения всех тестов.

## Критерии готовности

- [x] check выполняет pnpm test (backend unit + frontend) и pnpm test:int.
- [x] PostgreSQL 15 и Redis 7 запускаются как временные service containers с healthcheck.
- [x] Тесты используют costumes_test и Redis db 15 из .env.test.example без production-секретов и подключения к VPS.
- [x] Ошибка тестов блокирует build-and-push и deploy; время check ограничено.
- [x] Workflow проверен, локальные тесты зелёные, документация обновлена.

## План

Добавить сервисы в существующий check, подготовку тестового env и запуск всех тестов. Проверить YAML и команды, обновить .agents/architecture.md и .agents/testing.md. Закоммитить отдельно, без push и действий на VPS.

## Результат

В check добавлены PostgreSQL 15/Redis 7 с healthcheck, лимит 20 минут, общий pnpm test и pnpm test:int. Тестовый env создаётся из существующего шаблона, typecheck backend теперь включает test/. Установка зависимостей и сборка shared остаются общими для всех проверок; цепочка check → build-and-push → deploy сохранена.

Проверено: actionlint в официальном контейнере; разбор YAML и согласованность credentials/портов сервисов с .env.test.example, БД costumes_test, Redis db 15, зависимостей build/deploy от тестов. Shared build, Prisma generate, typecheck и lint обоих приложений прошли. pnpm test: 421 backend + 236 frontend; pnpm test:int: 101 тест (18 наборов). Integration использовал временные локальные PostgreSQL/Redis; реальные сервисы, дампы и VPS не затрагивались. Локальный .env.test не изменялся. Первый фактический запуск в GitHub Actions будет после push и открытия/обновления PR в main.

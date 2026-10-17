# T-008 · nginx.conf: нет `;` после `server_name`

- **Приоритет:** high — до сезона обязательно
- **Область:** Инфраструктура и гигиена репозитория
- **Создана:** 2026-10-15
- **Выполнена:** 2026-10-17

## Контекст

nginx.conf: нет `;` после `server_name` в блоке `listen 80` — похоже, редирект HTTP→HTTPS не работает.

## Критерии готовности

- [x] `;` добавлен, `nginx -t` проходит без предупреждений
- [x] HTTP-блок отдаёт 301 на https

## Результат

Добавлен `;` после `server_name` в блоке `listen 80` (`apps/crm-frontend/nginx.conf`). В контейнере фронта `nginx -t` — ок (раньше было предупреждение `server name "https://$host$request_uri" has suspicious symbols`), `curl http://localhost:8080/some/path` → `301`. Проверено в рамках [T-039](T-039-proverka-docker-sborki-na-pnpm.md).

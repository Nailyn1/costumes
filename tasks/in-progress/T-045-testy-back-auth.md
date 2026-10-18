# T-045 · Тесты backend: auth (логин, refresh, logout)

- **Приоритет:** medium
- **Область:** Тесты
- **Создана:** 2026-10-17

## Контекст

`apps/backend/src/auth/`: argon2id, JWT access + refresh в httpOnly cookie, refresh-токен хранится в Redis `rf:{userId}` с TTL 7 дней ([architecture.md](../../.agents/architecture.md)). Базовые 401 и логин покрыты integration-сценарием T-040.

Стратегия, структура и образцы — [testing.md](../../.agents/testing.md). Бизнес-правила — [domain.md](../../.agents/domain.md). Баги из domain.md §6 не чиним: поведение, которое владелец признал багом, фиксируем `it.todo` со ссылкой на задачу (T-024…T-029).

## Критерии готовности

- [x] Unit `AuthService`: неверный логин / пароль → 401 с одинаковым текстом (без утечки, существует ли логин); успешный логин выдаёт пару токенов и сохраняет refresh в Redis с TTL; payload токена (`id`, `login`).
- [ ] Refresh: валидный cookie → новая пара, старый refresh перестаёт работать (ротация); подменённый/истёкший/отозванный refresh → 401; отсутствие cookie → 401.
- [x] Logout: чистит cookie и ключ refresh в Redis; после logout refresh не работает.
- [x] Integration: login → защищённый эндпоинт → refresh → logout, атрибуты cookie (`httpOnly`, `secure` только в production, `sameSite`); просроченный access → 401; защищённые контроллеры без токена → 401 (таблица маршрутов). `webhooks/whatsapp` защищён отдельным `WebhookTokenGuard` (T-030), его существующие тесты не ослаблять.
- [x] Валидация DTO логина (login ≥ 6, password ≥ 12) → 400 с `Validation failed`.
- [x] WS-гард (`ws-jwt.guard.ts`): сокет без токена или с неверным токеном отклоняется.
- [x] Эквивалентные локальные запуски unit и integration зелёные; typecheck и полный backend lint без ошибок (`pnpm` не запускается в среде из-за EPERM).

## План

1. Добавить unit-тесты `AuthService` на единый ответ 401, payload и TTL refresh в Redis, ротацию и logout; отдельно проверить `WsJwtGuard`.
2. Добавить integration-сценарий cookie, защищённых маршрутов, refresh и logout через HTTP.
3. Запустить unit, typecheck и lint. Integration выполнит ведущий агент последовательно с другой задачей из-за общей БД/Redis.

## Результат

Добавлены unit-тесты `AuthService` и `WsJwtGuard` (12 пройдено) и HTTP integration-сценарии в `auth.int-spec.ts` (4/4 прошли). Проверки всего рабочего дерева: backend unit — 249 passed / 11 todo, integration — 29 passed, frontend — 116 passed / 6 todo; typecheck и lint прошли. Найдены отдельные задачи: T-085 — английские сообщения auth/WS; T-086 — быстрый refresh может вернуть тот же JWT и не отозвать старый cookie. Для них оставлены `it.todo`; фактический HTTP-флоу проверен без ложного утверждения о ротации.

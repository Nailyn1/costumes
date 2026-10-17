# T-045 · Тесты backend: auth (логин, refresh, logout)

- **Приоритет:** medium
- **Область:** Тесты
- **Создана:** 2026-10-17

## Контекст

`apps/backend/src/auth/`: argon2id, JWT access + refresh в httpOnly cookie, хэш refresh-токена в БД ([architecture.md](../../.agents/architecture.md)). Базовые 401 и логин покрыты integration-сценарием T-040.

Стратегия, структура и образцы — [testing.md](../../.agents/testing.md). Бизнес-правила — [domain.md](../../.agents/domain.md). Баги из domain.md §6 не чиним: поведение, которое владелец признал багом, фиксируем `it.todo` со ссылкой на задачу (T-024…T-029).

## Критерии готовности

- [ ] Unit `AuthService`: неверный логин / пароль → 401 с одинаковым текстом (без утечки, существует ли логин); успешный логин выдаёт пару токенов и сохраняет хэш refresh; payload токена (`id`, `login`).
- [ ] Refresh: валидный cookie → новая пара, старый refresh перестаёт работать (ротация); подменённый/истёкший/отозванный refresh → 401; отсутствие cookie → 401.
- [ ] Logout: чистит cookie и хэш refresh в БД; после logout refresh не работает.
- [ ] Integration: login → защищённый эндпоинт → refresh → logout, атрибуты cookie (`httpOnly`, `secure` только в production, `sameSite`); просроченный access → 401; все защищённые контроллеры без токена → 401 (таблица маршрутов), `webhooks/whatsapp` без guard.
- [ ] Валидация DTO логина (login ≥ 6, password ≥ 12) → 400 с `Validation failed`.
- [ ] WS-гард (`ws-jwt.guard.ts`): сокет без токена или с неверным токеном отклоняется.
- [ ] `pnpm test` и `pnpm test:int` зелёные, typecheck и lint без новых ошибок.

## План

<!-- заполняется при взятии в работу -->

## Результат

<!-- заполняется при завершении: что сделано, коммит/PR -->

# T-049 · Тесты frontend: axios-интерцепторы и обработка ошибок

- **Приоритет:** medium
- **Область:** Тесты
- **Создана:** 2026-10-17

## Контекст

`src/services/interceptors.ts`, `src/app/queryClient.ts`, `src/utills/handleError.ts`, `src/stores/auth.store.ts`: на них держатся авторизация и защита от дублей ([backend.md §7](../../.agents/backend.md)). Мажорные обновления затрагивают axios и React Query, поэтому поведение нужно зафиксировать заранее.

Стратегия, структура и образцы — [testing.md](../../.agents/testing.md). Бизнес-правила — [domain.md](../../.agents/domain.md). Баги из domain.md §6 не чиним: поведение, которое владелец признал багом, фиксируем `it.todo` со ссылкой на задачу (T-024…T-029).

## Критерии готовности

- [ ] Request: `Authorization: Bearer` из store; без токена заголовка нет; `X-Idempotency-Key` (UUID) на POST/PUT/PATCH, не на GET; заранее заданный ключ не перезаписывается; ключ новый на каждый запрос.
- [ ] Response 401: один refresh (`/auth/refresh`) и повтор исходного запроса с новым токеном; флаг `_retry` — повтор не зацикливается; параллельные 401 (зафиксировать текущее поведение); 401 на `/auth/*` не триггерит refresh; провал refresh → `logout()` и ошибка наружу.
- [ ] Прочие статусы (400/403/404/409/500) пробрасываются без refresh.
- [ ] `handleError`: тексты по статусам, `silentStatuses`, русское сообщение из `message` бэкенда; `queryClient`: `meta.silent` подавляет toast, ошибка мутации 401 не показывает toast.
- [ ] `auth.store`: `setAccessToken`, `logout` очищает persist; редирект приватного маршрута (`PrivateRoute`).
- [ ] Использовать MSW (реальный axios + XHR), а не моки axios.
- [ ] `pnpm test` зелёные, typecheck и lint без новых ошибок.

## План

<!-- заполняется при взятии в работу -->

## Результат

<!-- заполняется при завершении: что сделано, коммит/PR -->

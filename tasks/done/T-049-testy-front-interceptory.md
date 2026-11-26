# T-049 · Тесты frontend: axios-интерцепторы и обработка ошибок

- **Приоритет:** medium
- **Область:** Тесты
- **Создана:** 2026-10-17
- **Выполнена:** 2026-10-17

## Контекст

`src/services/interceptors.ts`, `src/app/queryClient.ts`, `src/utills/handleError.ts`, `src/stores/auth.store.ts`: на них держатся авторизация и защита от дублей ([backend.md §7](../../.agents/backend.md)). Мажорные обновления затрагивают axios и React Query, поэтому поведение нужно зафиксировать заранее.

Стратегия, структура и образцы — [testing.md](../../.agents/testing.md). Бизнес-правила — [domain.md](../../.agents/domain.md). Баги из domain.md §6 не чиним: поведение, которое владелец признал багом, фиксируем `it.todo` со ссылкой на задачу (T-024…T-029).

## Критерии готовности

- [x] Request: `Authorization: Bearer` из store; без токена заголовка нет; `X-Idempotency-Key` (UUID) на POST/PUT/PATCH, не на GET; заранее заданный ключ не перезаписывается; ключ новый на каждый запрос.
- [x] Response 401: один refresh (`/auth/refresh`) и повтор исходного запроса с новым токеном; флаг `_retry` — повтор не зацикливается; параллельные 401 (зафиксировать текущее поведение); 401 на `/auth/*` не триггерит refresh; провал refresh → `logout()` и ошибка наружу.
- [x] Прочие статусы (400/403/404/409/500) пробрасываются без refresh.
- [x] `handleError`: тексты по статусам, `silentStatuses`, русское сообщение из `message` бэкенда; `queryClient`: `meta.silent` подавляет toast, ошибка мутации 401 не показывает toast.
- [x] `auth.store`: `setAccessToken`, `logout` очищает persist; редирект приватного маршрута (`PrivateRoute`).
- [x] Использовать MSW (реальный axios + XHR), а не моки axios.
- [x] `pnpm test` зелёные, typecheck и lint без новых ошибок.

## План

<!-- заполняется при взятии в работу -->

## Результат

Добавлены тесты (MSW + реальный axios/XHR, моков axios нет): `src/services/interceptors.test.ts` (Authorization, `X-Idempotency-Key` только на POST/PUT/PATCH и не перезаписывается, новый на каждый запрос; 401 → один refresh и повтор с новым токеном и тем же ключом; без зацикливания; провал refresh → `logout()`; `/auth/*` не рефрешится; 400/403/404/409/500 пробрасываются), `src/utills/handleError.test.ts`, `src/app/queryClient.test.ts` (toast, `meta.silent`, 401 мутации без toast), `src/stores/auth.store.test.tsx` (store, persist после logout, `PrivateRoute`).
Зафиксировано «как есть»: параллельные 401 запускают по отдельному refresh на каждый запрос (общего промиса нет). Баги не найдены.

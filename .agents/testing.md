# Тестирование

Цель тестов — предсказуемое поведение системы перед мажорными обновлениями (NestJS 12, Mantine 9, [T-019](../tasks/backlog/T-019-obnovlenie-zavisimostey.md)) и в сезон, когда в проде живые брони. Тесты пишем **под бизнес-правила** из [domain.md](./domain.md), а не ради процента покрытия.

Три вида тестов:

| Вид | Где | Инструмент | Что поднимает |
|---|---|---|---|
| Backend unit | `apps/backend/src/**/*.spec.ts` | Jest + ts-jest | один сервис, Prisma/Redis — моки |
| Backend integration | `apps/backend/test/*.int-spec.ts` | Jest + supertest | настоящий `AppModule`, БД `costumes_test`, Redis db 15 |
| Frontend | `apps/crm-frontend/src/**/*.test.ts(x)` | Vitest + Testing Library + jsdom + MSW | функции / хуки / компоненты, сеть — MSW |

## 1. Команды

```bash
pnpm test                 # корень: unit backend + frontend
pnpm test:int             # корень: integration backend (нужны Postgres и Redis из docker-compose.dev.yml)

pnpm --filter @costumes/backend test                  # jest (unit)
pnpm --filter @costumes/backend test -- visit-order   # по имени файла
pnpm --filter @costumes/backend test:int
pnpm --filter @costumes/backend test:db:reset         # пересоздать costumes_test с нуля (запускает человек, см. §3.3)
pnpm --filter crm-frontend test                       # vitest run
pnpm --filter crm-frontend test:watch
```

Проверки перед завершением задачи — в [workflow.md](./workflow.md#3-definition-of-done).

## 2. Соглашения

- **Язык названий:** `describe`/`it` — **на английском**, в форме «что делает / при каких условиях» (`rejects a blacklisted client and mentions the reason`). Комментарии в тестах — на русском, коротко, только про «почему». Строки-ожидания (тексты ошибок) — как в коде, на русском.
- **Файлы:** unit backend — `<name>.spec.ts` рядом с кодом; integration — `<сценарий>.int-spec.ts` в `apps/backend/test/`; frontend — `<name>.test.ts(x)` рядом с кодом.
- **Один тест — одно правило.** Данные — через фабрики, а не копипастой литералов; в тесте видны только значения, важные для проверяемого правила.
- **`any` запрещён** и в тестах; для заглушек зависимостей — `as never` (как в существующем spec), для тел ответов — `as { field: T }`.
- **Баг-фикс = тест, воспроизводящий баг.** Сначала тест (красный на старом коде), потом исправление. Найденный, но не исправляемый сейчас баг — `it.todo('... (T-NNN)')` со ссылкой на задачу в `tasks/backlog/`; зафиксированное «как есть» поведение помечай комментарием.
- Тесты не зависят от текущей даты/порядка запуска. Время — как в проде: местное время = UTC «как есть» ([domain.md](./domain.md#время-и-даты-важно)), `new Date('2026-12-20T10:00:00Z')`.
- Не подключай реальный Green-API, не ходи в сеть, не трогай dev-БД `costumes` и Redis db 0.

### Что тестируем обязательно
- Бизнес-правила и инварианты [domain.md §3](./domain.md#3-бизнес-правила-инварианты): занятость костюма (пересечение периодов), `prepaymentAmount ≤ rentPrice`, выдача только `reserved` и атомарность, возврат закрывает визит целиком, чёрный список, одна дата на визит.
- Деньги: остаток, итоги визита, раскладка доплаты по заказам, залог.
- Статусы и переходы: Visit / Order / tagStatus / Deposit; приоритет статусов уведомлений (статус только растёт).
- **Soft delete:** каждая выборка фильтрует `deletedAt: null`; удалённые сущности — «не найден».
- Время: склейка даты и времени в UTC «как есть», окна выдачи/возврата.
- Поиск и ранжирование (`search.utils`), валидация входа (Zod → 400), 401/404/409.
- Frontend: чистая логика (итоги, дефолты форм, форматтеры), хуки с запросами, интерцепторы axios (refresh на 401, идемпотентность), компоненты с правилами (чёрный список недоступен для выбора, кнопка «Костюмы возвращены» активна только при всех отметках).

### Что не тестируем
- Вёрстку, стили, адаптивность (проверяется глазами на 375px — см. DoD), снапшоты разметки.
- Внутренности Mantine / React Query / Nest / Prisma.
- Сгенерированный код: `shared/src/openapi-client.ts`, `src/prisma/generated`, TypeSpec-вывод.
- Тривиальные геттеры и «проброс» controller → service без логики (HTTP-слой проверяется integration-сценариями).

## 3. Backend

### 3.1 Unit (`*.spec.ts`)

Сервис создаётся вручную с моками зависимостей, без Nest `Test.createTestingModule`. Общие помощники — `apps/backend/src/test-utils/` (не попадают в сборку: исключены в `tsconfig.build.json`):

- `createPrismaMock()` → `{ prisma, tx, reset }`. `prisma` — мок `PrismaService`, `tx` — клиент, который получает callback в `$transaction(async (tx) => ...)`. Делегаты (`tx.visit.findFirst`…) создаются лениво, схему перечислять не нужно. `reset` вызывать в `beforeEach`.
- Фабрики `makeClient / makeChild / makeCostume / makeVisit / makeOrder / makeDeposit / makeCreateVisitRequest` — валидный объект по умолчанию + `overrides`.
- `test-database.ts` → проверка имени `*_test` и подготовка отсутствующей тестовой БД; `test/prepare-test-db.ts` импортирует его из `src/test-utils`, чтобы unit-тест не выводил файлы за пределы `rootDir: src` watch-сборки.
- Сгенерированный Prisma-клиент и `PrismaService` в unit-тестах подменены заглушками через `moduleNameMapper` в `jest`-секции `package.json` (клиент импортирует `./x.js`, который ts-jest не резолвит) — в spec для этого ничего писать не нужно.

Образцы: `src/visit-order/visit-order.service.spec.ts` (сервис + Prisma-мок), `src/common/utils/search.utils.spec.ts` (чистые функции).

```ts
const { prisma, tx, reset } = createPrismaMock();
beforeEach(reset);

it('rejects a deleted visit as not found', async () => {
  tx.visit.findFirst.mockResolvedValue(null);
  await expect(service.visitIssue(issueData, 1)).rejects.toThrow('Визит с ID 1 не найден');
  expect(tx.visit.findFirst).toHaveBeenCalledWith({ where: { id: 1, deletedAt: null }, include: { orders: true } });
});
```

Проверяй не только результат, но и **where-условия** (фильтр `deletedAt: null`, статусы) и что при ошибке ничего не записано (`expect(tx.order.update).not.toHaveBeenCalled()`).

ts-jest работает с `isolatedModules` (`tsconfig.jest.json`) — типы в тестах не проверяются jest'ом; типы проверяет `pnpm --filter @costumes/backend typecheck` (включает `test/`).

### 3.2 Integration (`apps/backend/test/*.int-spec.ts`)

Поднимается настоящий `AppModule` in-process (`test/support/test-app.ts`, `createTestApp()`), без фиксированного порта — supertest слушает эфемерный. Что заменено:

| Зависимость | Как |
|---|---|
| Postgres | отдельная БД **`costumes_test`** в том же dev-Postgres; таблицы чистятся (`TRUNCATE … RESTART IDENTITY CASCADE`) при старте набора |
| Redis | тот же dev-Redis, логическая БД `REDIS_DB` (по умолчанию **15**), `FLUSHDB` при старте и в конце; dev-данные в db 0 не затрагиваются |
| Очередь BullMQ `notifications` | заглушка `t.notificationQueue.add` (jest.fn); процессор подменён пустым — иначе Worker читал бы настоящую очередь из db 0 |
| Green-API (`WhatsappProvider`) | мок `t.whatsapp` (`sendMessage`, `getStateInstance`) |
| Логи | pino молчит |

`createTestApp()` создаёт тестового сотрудника и возвращает `{ app, prisma, redis, notificationQueue, whatsapp, user, close }`. Хелперы `test/support/http.ts`: `login(app, user)` → accessToken, `authed(app, token)` → `get/post/patch/delete` с Bearer. Проверяй результат **в БД через `t.prisma`**, а не только по ответу API.

Образец — `test/visit-flow.int-spec.ts`: логин → клиент → ребёнок → костюм → preview-code → визит (`sendNotification=false`) → бирка → выдача → возврат, плюс уведомление/очередь, незарезервированный код, пересечение броней.

`createTestApp()` повторяет настройку из `main.ts` (cookie-parser, фильтр Prisma, ZodValidationPipe, Sentry-интерцептор) — **при изменении `bootstrap()` обнови и её**.

### 3.3 Настройка окружения для integration

1. Dev-инфраструктура запущена (`docker compose -f docker-compose.dev.yml up -d`) — **один экземпляр** Postgres/Redis на все worktree, второй не поднимай.
2. `cp apps/backend/.env.test.example apps/backend/.env.test` (файл не коммитится; при отсутствии берётся `.env.test.example`). Переменные: `DATABASE_URL` (БД **должна** оканчиваться на `_test` — иначе `test:int` откажется стартовать), `REDIS_*` + `REDIS_DB`, `JWT_SECRET`, данные тестового сотрудника. Настоящие `.env` тесты не читают.
3. `pnpm test:int` сам вызывает `test/prepare-test-db.ts`: если БД из `DATABASE_URL` ещё нет, скрипт создаёт её через служебную БД `postgres`, затем запускает `prisma migrate deploy`. Автосоздание разрешено только для PostgreSQL БД с суффиксом `_test`; пользователь PostgreSQL должен иметь право `CREATEDB`. Повторный запуск использует существующую БД и накатывает только недостающие миграции. Сам `migrate deploy` данные не удаляет; integration-наборы очищают таблицы при старте.
4. Полное пересоздание тестовой БД — `pnpm --filter @costumes/backend test:db:reset` (`prisma migrate reset --force`). Prisma блокирует эту команду при запуске из AI-агента без явного согласия — запускай вручную из своего терминала. Нужно после правки/отката миграций в ветке.
5. Jest для integration запускается с `--experimental-vm-modules` (сгенерированный Prisma-клиент использует динамический `import()`), `--runInBand` (одна БД на все наборы) — это уже прописано в `test:int`.

Два набора integration-тестов параллельно в разных worktree **не запускай**: БД и Redis общие.

## 4. Frontend

Vitest + `@testing-library/react` + `@testing-library/user-event` + jsdom + MSW. Конфиг — `apps/crm-frontend/vitest.config.ts`; `VITE_API_URL=http://api.test`, jsdom-origin совпадает с ним (иначе XHR упирается в CORS).

Общие файлы в `apps/crm-frontend/test/`:
- `setup.ts` — jest-dom, полифилы для Mantine (`matchMedia`, `ResizeObserver`, `scrollIntoView`), жизненный цикл MSW (`onUnhandledFrame: "error"` — запрос без обработчика роняет тест), `cleanup`.
- `server.ts` — `server` (MSW) и `API_URL`; в тесте — `server.use(http.get(`${API_URL}/clients/search`, () => HttpResponse.json([...])))`.
- `render.tsx` — `renderWithProviders(ui)` и `renderHookWithProviders(hook)`: тестовый `QueryClient` (без ретраев), `MantineProvider`, `Notifications`, `MemoryRouter`.

Правила:
- Чистую логику (расчёты, дефолты, форматирование) выноси из компонентов в `utils/` и тестируй как функции; вынос — отдельным `refactor(front)`-коммитом без изменения поведения (пример: `features/visits/utils/orderTotals.ts`).
- Ответы MSW должны проходить Zod-валидацию typed-openapi клиента из `@costumes/shared`, включая статус HTTP по контракту; собирай их по схемам (телефон `+7XXXXXXXXXX`, имена кириллицей и т.п.).
- Ищи элементы по тексту/роли/placeholder, как пользователь. Опции Mantine `Select` — `getByText(...).closest("[data-combobox-option]")`. Для debounce (400 мс) используй `findBy*` с `{ timeout: 3000 }`, не `setTimeout` в тесте (кроме проверки «запроса не было»).
- Не тестируй мобильную вёрстку (`useMediaQuery` в jsdom всегда `false`).

Образцы: `features/visits/utils/orderTotals.test.ts` (функция), `features/clients-children/hooks/useClients.test.tsx` (хук), `features/clients-children/components/clients/clientSearchField.test.tsx` (компонент + MSW: клиент из чёрного списка недоступен для выбора).

## 5. План покрытия

Покрытие по модулям — отдельные задачи в `tasks/backlog/` (T-041…T-049); приоритет у `visit-order` и формы брони. Прогон тестов в CI — [T-015](../tasks/backlog/T-015-proverki-v-ci-pered-deploem.md).

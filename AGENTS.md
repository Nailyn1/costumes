# Costumes CRM

Внутренняя CRM точки проката детских костюмов: клиенты и дети, костюмы, бронирование (визиты и заказы), бирки, выдача, возврат, залоги, WhatsApp-уведомления клиентам. Одна точка, несколько сотрудников без ролей, работа с ПК и телефона. Пиковый сезон — новогодние праздники; система в проде с прошлого сезона (~500 аренд).

Монорепозиторий (pnpm workspaces):
- `apps/backend` — NestJS 12, Prisma 7, PostgreSQL 15, Redis 7, BullMQ, Socket.IO
- `apps/crm-frontend` — React 19, Vite 8, Mantine 9, TanStack Query 5, Zustand 5
- `shared` — контракт API: TypeSpec → OpenAPI → Zod 4-схемы + typed-openapi-клиент

## Документация — читай перед работой

| Файл | Когда читать |
|---|---|
| [.agents/domain.md](.agents/domain.md) | **Всегда** при работе с бизнес-логикой: сущности, статусы, флоу, инварианты, известные баги |
| [.agents/architecture.md](.agents/architecture.md) | Как устроена система, Redis-ключи, auth, деплой |
| [.agents/deployment.md](.agents/deployment.md) | Production VPS, расположение файлов, сертификаты, восстановление БД и деплой |
| [.agents/backend.md](.agents/backend.md) | Любые изменения в `apps/backend` |
| [.agents/frontend.md](.agents/frontend.md) | Любые изменения в `apps/crm-frontend` |
| [.agents/shared-api.md](.agents/shared-api.md) | **Любое** изменение API (эндпоинт, параметр, тип) |
| [.agents/setup.md](.agents/setup.md) | Запуск, env, команды |
| [.agents/workflow.md](.agents/workflow.md) | Цикл задачи, Definition of Done, правила коммитов |
| [.agents/testing.md](.agents/testing.md) | Тесты: стратегия, структура, команды (`pnpm test`, `pnpm test:int`); читай при любом изменении логики и баг-фиксе |
| [tasks/](tasks/README.md) | Задачи: `backlog/` · `in-progress/` · `done/` (один файл = одна задача) |

## Быстрый старт

```bash
pnpm install
docker compose -f docker-compose.dev.yml up -d
pnpm --filter @costumes/shared build
cd apps/backend && pnpm exec prisma migrate dev && pnpm db:seed && cd ../..
pnpm dev:backend    # http://localhost:5000
pnpm dev:frontend   # http://localhost:5173
```

## Главные правила

1. **API меняется только через `shared`**: TypeSpec (`shared/api-spec/modules/*.tsp`) → `pnpm gen:api` (в `shared`) → ручной экспорт в `shared/src/*.ts` → `pnpm build` (в `shared`). Никаких локальных API-типов в apps. Подробно — [shared-api.md](.agents/shared-api.md).
2. **Backend:** Controller → Service → Repository → Prisma (репозиторий — только доступ к данным, без бизнес-правил; добавляем постепенно в каждый модуль, пока есть модули, где Service ходит в Prisma напрямую — новые модули сразу с репозиторием); валидация через `createZodDto(Schema)`; транзакции для многотабличных операций; **soft delete** (`deletedAt`) и фильтр `deletedAt: null` во всех выборках; ошибки — Nest-исключения с русским текстом.
3. **Время:** сервер в `TZ=UTC`, местное время хранится как UTC «как есть» — никаких конвертаций часовых поясов.
4. **Frontend:** component → React Query hook → service → `apiClient`; только Mantine без своих CSS; формы — `@mantine/form` + `zodResolver`; каждый экран обязан работать на мобильном.
5. `any` запрещён в обоих приложениях.
6. Неясное бизнес-правило — **спроси владельца**, не угадывай. Новые найденные проблемы — задачей в [`tasks/backlog/`](tasks/README.md), не чинить молча.
7. **Тесты:** новая бизнес-логика и баг-фиксы — вместе с тестами ([testing.md](.agents/testing.md)); `pnpm test` и `pnpm test:int` зелёные до коммита.
8. Миграции Prisma — только новые через `prisma migrate dev`; применённые не редактировать; деструктивные — только с согласия владельца (в проде живые данные).

## Git

- **Не коммитить и не пушить без явной просьбы владельца.** Перед коммитом — проверки из Definition of Done ([workflow.md](.agents/workflow.md#3-definition-of-done)).
- Никогда не коммитить `.env*` (кроме `apps/crm-frontend/.env.production`), сертификаты, дампы, `dist`, `src/prisma/generated`.
- Conventional Commits на английском: `<type>(<scope>): <summary>`; type: `feat | fix | refactor | chore | docs | test | style`; scope: `front | back | shared | root | infra`.
  Примеры: `fix(front): keep search combobox above app header`, `feat(back): add visit return endpoint`.
- Ветки: `<type>/<short-description>` от `main`. **`main` = прод** (автодеплой через GitHub Actions).

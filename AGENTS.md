# Project: Costumes CRM

## 1. Project Overview

Это full-stack система (CRM) для управления бизнесом по аренде костюмов.
Главные бизнес-процессы: учет клиентов, бронирование костюмов, ведение заказов (визитов) и управление детскими костюмами.

## 2. Tech Stack

- **Frontend:** React, Mantine (UI), Tanstack Query, Zustand, TypeScript.
- **Backend:** Node.js, Nest.js, TypeScript.
- **Database / Cache:** PostgreSQL, Redis.
- **Infrastructure:** Docker, Nginx.
- **API & Types:** TypeSpec (для генерации OpenAPI и Zod-схем в пакете `shared`).

## 3. Directory Structure & Specific Rules

- `apps/crm-frontend` — React приложение. [Перед работой с UI читай /docs/FRONTEND_RULES.md]
- `apps/backend` — Node.js сервер. [Перед работой с API читай /docs/BACKEND_RULES.md]
- `/shared` — Общий пакет типов, схем и контрактов API.
- `/docs` — Архитектурные решения и правила для frontend and backend.

## 4. CRITICAL WORKFLOW: Modifying API & Shared Types

- Никогда не коммить чувствительные данные (env файлы)

**ВАЖНО:** Запрещено напрямую менять типы и контракты API в бэкенде или фронтенде. Любое изменение API (добавление эндпоинта, изменение параметров, обновление типов) ДОЛЖНО происходить через пакет `shared` по следующему строгому алгоритму:

1. **Обнови TypeSpec файлы:**
   Внеси изменения в `.tsp` файлы в `shared/modules/` (например, `auth.tsp`, `children.tsp`, `clients.tsp`, `costumes.tsp`, `visits.tsp`).
2. **Сгенерируй OpenAPI:**
   Перейди в директорию `shared` (или `costumes/shared`) и выполни команду генерации API:
   `[npm run gen:api в папке shared]`
3. **Экспортируй типы и схемы:**
   Если был создан новый эндпоинт или тип, открой соответствующий файл в `shared/src/` (например, `auth.ts`, `children-client.ts`, `costumes.ts`, `visits-orders.ts`) и вручную пропиши экспорт Zod-схемы и TypeScript типа на основе сгенерированных данных.
   _Пример:_

```typescript
   export type AddClientInBlackListRequestDto = z.infer<typeof schemas.Clients_blacklistReason>;
   export const CreateClientRequestSchema = schemas.Clients_CreateClientRequest;
4. **Собери пакет shared:**
    Выполни сборку пакета, чтобы обновить файлы в папке dist. Только после этого бэкенд и фронтенд получат доступ к новым типам.
    [npm run build в папке shared]

## 5. Useful Commands
    Запуск инфраструктуры локально (БД, Redis): [docker compose -f docker-compose.dev.yml up -d]
    Запуск Backend: в корне проекта costumes [npm run dev:backend]
    Запуск Frontend: в корне проекта costumes [npm run dev:frontend]
```

## Git & Commit Rules

- Do not commit unless the user explicitly asks.
- Before committing, run relevant checks when practical.
- Use Conventional Commits.
- Commit messages must be in English.
- Format: `<type>(<scope>): <summary>`

Allowed types:

- `feat` - new feature
- `fix` - bug fix
- `refactor` - code restructuring without behavior change
- `chore` - tooling/config/maintenance
- `docs` - documentation only
- `test` - tests only
- `style` - formatting only

Scopes:

- `front`
- `back`
- `shared`
- `root`
- `infra`

Examples:

- `fix(front): keep search combobox above app header`
- `feat(back): add visit return endpoint`
- `docs(root): document local development workflow`

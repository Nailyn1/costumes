# T-019 · Обновление зависимостей

- **Приоритет:** high — до сезона обязательно
- **Область:** Зависимости
- **Создана:** 2026-10-15
- **Выполнена:** 2026-10-20

## Контекст

Обновление зависимостей (решение владельца: все мажоры сразу, но по одному пакету за шаг с проверкой после каждого): patch/minor всего; затем NestJS 12, Mantine 9, Vite 8 + `@vitejs/plugin-react` 6, ESLint 10, framer-motion, ioredis 6, BullMQ 6, nestjs-pino 5, Sentry 11, Prisma 7.10. TypeScript 7 — отдельно, после оценки совместимости.

## Критерии готовности

- [x] Все разрешённые зависимости обновлены до актуальных стабильных версий: patch/minor и согласованные major-группы; Zod 4, Zodios/генератор API и TypeScript 7 исключены.
- [x] Node >=24.9.0 и pnpm workspace поддержаны; Prisma не требует деструктивных изменений схемы/данных.
- [x] Для каждой группы зафиксированы версия и результат проверки; shared/backend/frontend проходят доступные build/typecheck/lint/unit проверки.
- [x] Карточка содержит список отложенного и заблокированного.

## План

1. Обновить каталоги версий в package manifests и pnpm-lock.yaml небольшими группами; после каждой группы установить зависимости и проверить совместимость.
2. Проверить актуальные стабильные версии по npm и официальным release notes, исключив TypeScript 7, Zod 4 и API-клиент/генераторы по T-020.
3. Пройти сборки, typecheck, lint и unit тесты shared/backend/frontend; integration оценить отдельно с учётом доступности локальных сервисов.
4. Перенести карточку в done только после фиксации результатов и оставшихся задач.

## Результат

Обновления установлены в отдельной ветке `chore/dependency-upgrade`, без коммита и без изменений Prisma schema/migrations. Node runtime gate поднят до `>=24.9.0`: корневой `package.json`, `.nvmrc` (24), GitHub Actions, оба Dockerfile и `.agents/setup.md`. На локальной системе Node 22.16, ниже нового минимума; проверки выполнялись переносимым официальным Node v24.9.0 из `.t019-runtime` (SHA256 сверен с Node.js release page; сохранить папку до повторных проверок T-020).

Основные версии: NestJS 12.1.3 (связанные `@nestjs/*` 12.x), TypeScript 6.0.3, Mantine 9.7.3, Vite 8.3.4 + `@vitejs/plugin-react` 6.1.2, ESLint 10.13.0, framer-motion 14.3.0, ioredis 6.0.0, BullMQ 6.3.17, nestjs-pino 5.3.1, Sentry 11.8.0, Prisma 7.10.1, argon2 0.45.1, dotenv 18.0.8 и react-intersection-observer 11.0.1. Также обновлены совместимые patch/minor зависимости, TypeSpec toolchain до 1.17.0, Jest и типы до 30.x, webpack до 5.112.0 для совместимости peer requirements. Сохранены Zod 3.25.76 и API generation stack для T-020.

Nest 12 ESM требует запускать Jest с `--experimental-vm-modules`; этот флаг добавлен в Jest scripts. Для TypeScript 6 удалён frontend `baseUrl` (заменён точным `src/*` path mapping), а backend явно задаёт типы Jest/Node. Sentry профилирование перенесено на `profileSessionSampleRate`/`profileLifecycle` и node profiling integration; старый `sendDefaultPii: true` удалён согласно migration guide, где для него описано совпадающее поведение `dataCollection` по умолчанию.

### Проверки

- `pnpm --filter @costumes/shared build` — passed.
- `pnpm --filter @costumes/backend build`, `typecheck`, `lint` — passed.
- `pnpm --filter crm-frontend build`, `lint` — passed; Vite сообщает о bundle chunk 1.54 MB.
- `pnpm test` — backend 14 suites / 261 passed / 5 todo; frontend 13 files / 118 passed / 1 todo.
- `pnpm --filter @costumes/shared gen:api` — passed; существующий контракт API не изменился.
- `pnpm test:int` — 7 наборов, 33 теста прошли 2026-10-20 на отдельной `costumes_test` после переноса изменений в `set-agent`.
- `pnpm outdated -r` больше не показывает доступные разрешённые обновления; оставшиеся предложения: Zod 4 (T-020), TypeScript 7 (отдельная оценка), Prisma 8.0.0-rc.23 (pre-release; остаёмся на stable Prisma 7.10.1). Миграции БД не создавались и не применялись.

### Отложено и заблокировано

- Zod 4 и замена API generator/client на `typed-openapi` — T-020.
- TypeScript 7 — отдельная оценка совместимости.
- Prisma 8.0.0-rc.23 — не stable release.
- При первом запуске на пустом PostgreSQL тестовую БД пришлось создать вручную; автоматизацию вынесли в T-089.
- `@nestjs/schematics@12.0.7` требует Node 24.15+ для генераторов/`nest upgrade`; приложение, build и Jest проверены на Node 24.9+. Для генераторов использовать актуальный Node 24.x (как задаёт `.nvmrc`).

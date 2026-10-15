# Shared: контракт API (`shared/`)

**Любое изменение API начинается здесь.** Запрещено менять форму запросов/ответов напрямую в бэкенде или фронтенде, объявлять локальные интерфейсы для API-тел или править `openapi-client.ts` руками.

## 1. Как устроено

```
shared/
├── api-spec/
│   ├── main.tsp              # точка входа: импорты модулей, @service, BearerAuth
│   ├── common/errors.tsp     # Common.Error { code, message }
│   ├── modules/
│   │   ├── auth.tsp
│   │   ├── clients.tsp       # namespace CostumeApp.Clients
│   │   ├── children.tsp      # namespace CostumeApp.Children
│   │   ├── costumes.tsp      # namespace CostumeApp.Costumes (+ scalars InventoryCode, VisitCode)
│   │   └── visits.tsp        # namespace CostumeApp.Visits (+ TimeString)
│   ├── tspconfig.yaml        # emitter @typespec/openapi3, OpenAPI 3.1
│   └── tsp-output/           # сгенерированный openapi.yaml (в .gitignore)
├── src/
│   ├── openapi-client.ts     # СГЕНЕРИРОВАН: Zod-схемы `schemas.*` + `createApiClient` (Zodios). Не править руками
│   ├── auth.ts               # ручные экспорты: типы *Dto и схемы *Schema
│   ├── children-client.ts
│   ├── costumes.ts
│   ├── visits-orders.ts
│   └── index.ts              # реэкспорт всего
└── dist/                     # результат build (CommonJS + .d.ts), в .gitignore
```

Цепочка: **`.tsp` → `tsp compile` → `openapi.yaml` → `openapi-zod-client` → `src/openapi-client.ts` → ручной экспорт в `src/<domain>.ts` → `tsc --build` → `dist/`**.

Именование, которое получается на выходе:
- схема: `schemas.<Namespace>_<Model>` → `schemas.Costumes_CreateCostumeRequest`;
- метод клиента: `<Interface>_<operation>` → `apiClient.CostumeOperations_create`.

## 2. Алгоритм изменения API (строго по порядку)

1. **TypeSpec.** Правишь/добавляешь модель и операцию в `shared/api-spec/modules/<domain>.tsp`. Новый модуль — добавь `import` в `main.tsp`.
   - Ограничения валидации описывай в TypeSpec (`@minLength`, `@pattern`, `@minValue`) — они попадут в Zod и будут работать и на фронте, и на бэке.
   - Ответы операций — `Model | Common.Error`; явный код — `{ @statusCode statusCode: 201; @body body: Model }`.
   - Даты — `plainDate` (`YYYY-MM-DD`), время — `CostumeApp.Visits.TimeString` (`HH:mm`).
2. **Генерация.**
   ```bash
   cd shared
   npm run gen:api
   ```
   Перегенерирует `api-spec/tsp-output` и `src/openapi-client.ts`. Посмотри `git diff src/openapi-client.ts` — изменения должны быть только ожидаемыми.
3. **Ручной экспорт** в `shared/src/<domain>.ts` (только то, что реально используется):
   ```ts
   export type CreateCostumesRequestDto = z.infer<typeof schemas.Costumes_CreateCostumeRequest>;
   export const CreateCostumesRequestSchema = schemas.Costumes_CreateCostumeRequest;
   ```
   Соглашение: типы — `<Что><Request|Response>Dto`, схемы — `<Что><Request|Response>Schema`, PascalCase. (В `visits-orders.ts` есть старые имена с маленькой буквы — новые так не называй.)
4. **Сборка** (нужна бэкенду, фронт читает `src` напрямую):
   ```bash
   npm run build   # в shared
   ```
   В режиме разработки можно держать `npm run dev:shared` (tsc --watch) из корня.
5. **Реализация**: backend (DTO через `createZodDto`, контроллер, сервис) → frontend (service → hook → компонент).
6. **Проверка**: typecheck всех трёх пакетов (см. [workflow.md](./workflow.md#3-definition-of-done)).

## 3. Подводные камни

- Сгенерированные схемы — `.passthrough()`: лишние поля не отрезаются.
- Zod зафиксирован на v3 (`overrides` в корневом `package.json`) — этого требуют `openapi-zod-client` и `@zodios/core`. Не поднимай Zod до 4 без отдельной задачи на замену генератора/клиента.
- Если новый метод не появился в `apiClient` — проверь, что модуль импортирован в `main.tsp`, и что операция внутри `interface` с `@route`.
- `shared/api-spec/package.json` — исторический дубль зависимостей; рабочие скрипты — в `shared/package.json`.
- Изменение формата существующего поля = breaking change для обоих приложений: правь фронт и бэк в одной задаче.

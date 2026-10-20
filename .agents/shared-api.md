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
│   ├── openapi-client.ts     # generated typed-openapi клиент и именованные Zod 4 схемы. Не править руками
│   ├── openapi-client.types.d.ts # generated endpoint/schema declarations
│   ├── schemas.ts            # ручной namespace `schemas.*` для DTO экспорта
│   ├── auth.ts               # ручные экспорты: типы *Dto и схемы *Schema
│   ├── children-client.ts
│   ├── costumes.ts
│   ├── visits-orders.ts
│   └── index.ts              # реэкспорт всего
└── dist/                     # результат build (CommonJS + .d.ts), в .gitignore
```

Цепочка: **`.tsp` → `tsp compile` → OpenAPI 3.1 → `typed-openapi` → `src/openapi-client.ts` → ручные экспорты в `src/schemas.ts` и `src/<domain>.ts` → `tsc --build` → `dist/`**. Zod 4 используется в обеих сборках; generated schemas валидируют входы и ответы.

Именование, которое получается на выходе:
- generated schema: named export `Costumes_CreateCostumeRequest`;
- ручной совместимый namespace `schemas.Costumes_CreateCostumeRequest` собран в `src/schemas.ts` и используется доменными экспортами.
- frontend вызывает `apiClient.post("/costumes", { body })`, `apiClient.get("/costumes/list", { query })` и т.п.; HTTP transport — Axios singleton `apps/crm-frontend/src/services/api.ts` через `apiClient.ts` adapter.

## 2. Алгоритм изменения API (строго по порядку)

1. **TypeSpec.** Правишь/добавляешь модель и операцию в `shared/api-spec/modules/<domain>.tsp`. Новый модуль — добавь `import` в `main.tsp`.
   - Ограничения валидации описывай в TypeSpec (`@minLength`, `@pattern`, `@minValue`) — они попадут в Zod и будут работать и на фронте, и на бэке.
   - Ответы операций — `Model | Common.Error`; явный код — `{ @statusCode statusCode: 201; @body body: Model }`.
   - Даты — `plainDate` (`YYYY-MM-DD`), время — `CostumeApp.Visits.TimeString` (`HH:mm`).
2. **Генерация.**
   ```bash
   cd shared
   pnpm gen:api
   ```
   Перегенерирует `api-spec/tsp-output`, `src/openapi-client.ts` и `src/openapi-client.types.d.ts`. Посмотри diff обоих generated файлов.
3. **Ручной экспорт** в `shared/src/<domain>.ts` (только то, что реально используется):
   ```ts
   export type CreateCostumesRequestDto = z.infer<typeof schemas.Costumes_CreateCostumeRequest>;
   export const CreateCostumesRequestSchema = schemas.Costumes_CreateCostumeRequest;
   ```
   Соглашение: типы — `<Что><Request|Response>Dto`, схемы — `<Что><Request|Response>Schema`, PascalCase. (В `visits-orders.ts` есть старые имена с маленькой буквы — новые так не называй.)
4. **Сборка** (нужна бэкенду, фронт читает `src` напрямую):
   ```bash
   pnpm build   # в shared
   ```
   В режиме разработки можно держать `pnpm dev:shared` (tsc --watch) из корня.
5. **Реализация**: backend (DTO через `createZodDto`, контроллер, сервис) → frontend (service → hook → компонент).
6. **Проверка**: typecheck всех трёх пакетов (см. [workflow.md](./workflow.md#3-definition-of-done)).

## 3. Подводные камни

- Для сохранения совместимости с прежними `.passthrough()` конфигурация `typed-openapi.config.mjs` задаёт `openapi.additionalPropertiesDefault: true`; generated object schemas используют `.catchall(z.unknown())`, поэтому незнакомые поля сохраняются.
- Frontend transport обязан использовать экспортированный Axios singleton `api`; он обеспечивает cookies, bearer token, refresh/retry и `X-Idempotency-Key`. Оставляй Axios `validateStatus` по умолчанию: custom fetcher должен переводить Axios HTTP errors с `response` в FetcherResponse после interceptor, а network errors без response — пробрасывать.
- Передавай в `createApiClient` абсолютный base URL (`new URL(API_BASE_URL, window.location.origin)`), так как runtime формирует `URL`; при относительном `/api` не добавляй этот префикс повторно в Axios.
- Валидация включена для обеих сторон: `validate: "both"`. Изменение генератора или transport должно покрывать request/response validation, 204, HTTP errors, 401 refresh с тем же idempotency key и неизвестные поля.
- Если новый метод не появился в `apiClient` — проверь, что модуль импортирован в `main.tsp`, и что операция внутри `interface` с `@route`.
- `shared/api-spec/package.json` — исторический дубль зависимостей; рабочие скрипты — в `shared/package.json`.
- Изменение формата существующего поля = breaking change для обоих приложений: правь фронт и бэк в одной задаче.

# Frontend: правила разработки (`apps/crm-frontend`)

React 19, Vite 8, TypeScript (strict), Mantine 9 (`core`, `dates`, `form`, `hooks`, `notifications`), TanStack Query 5, Zustand 5, React Router 7, typed-openapi клиент из `@costumes/shared` через Axios singleton, Socket.IO-клиент, dayjs, `@tabler/icons-react`, Sentry.

## 1. Структура (feature-based)

```
src/
├── main.tsx                # провайдеры: QueryClient, MantineProvider (auto color scheme), Notifications, Router
├── app/
│   ├── router.tsx          # все маршруты (см. domain.md §4)
│   ├── queryClient.ts      # глобальный QueryClient: retry 1, глобальные onError → toast
│   ├── providers/PrivateRoute.tsx
│   └── sentry.ts
├── pages/                  # экраны: только композиция фич и layout, без логики и запросов
├── features/<domain>/      # auth, clients-children, costumes, visits, notifications
│   ├── components/         # UI фичи (формы, модалки, таблицы, карточки)
│   ├── hooks/              # React Query хуки (useQuery / useMutation / useInfiniteQuery)
│   ├── services/           # тонкие обёртки над apiClient
│   └── types/              # локальные типы пропсов/форм (не API-типы!)
├── components/             # общий UI: MainLayout, AddButtonWithModal, ConfirmDeleteModal, MoneyInput, selection/*
├── services/               # api.ts (axios), apiClient.ts (typed-openapi/Axios adapter), interceptors.ts, socket.client.ts
├── stores/                 # Zustand: auth.store.ts
└── utils/                  # handleError.ts, formatters.ts
```

Импорты — абсолютные от `src/` (`import { apiClient } from "src/services/apiClient"`), внутри фичи допустимы относительные.

## 2. Данные и API

Цепочка всегда одна: **component → hook (React Query) → service → `apiClient` (typed-openapi → Axios singleton) → backend**.

```ts
// services/costumes.service.ts
export const costumeService = {
  createCostume(data: CreateCostumesRequestDto) {
    return apiClient.post("/costumes", { body: data });
  },
};

// hooks/useCostumes.ts
export const costumesKeys = {
  all: ["costumes"] as const,
  lists: () => [...costumesKeys.all, "list"] as const,
  detail: (id: number | string) => [...costumesKeys.all, "detail", String(id)] as const,
};

export function useCreateCostume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCostumesRequestDto) => costumeService.createCostume(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: costumesKeys.lists() }),
  });
}
```

Правила:
- API-типы и схемы — **только из `@costumes/shared`**. Не дублируй их в `types/`.
- Не вызывай `axios`/`api` напрямую — используй typed-openapi методы `apiClient.get/post/patch/delete` с путём и параметрами из OpenAPI; transport настроен поверх Axios singleton.
- Query keys — фабрика `<domain>Keys` в файле хуков; инвалидация после мутаций — по префиксу (`["visits"]`, `costumesKeys.lists()`). Мутации, меняющие визиты, обычно инвалидируют и `["visits"]`, и `["costumes"]`.
- Списки с подгрузкой — `useInfiniteQuery` + `hasMore`/`page` из ответа + `react-intersection-observer`.
- Live-поиск: `useDebouncedValue(value, 300–500)`, `enabled: query.trim().length >= 2`, `placeholderData: keepPreviousData`.
- Ошибки запросов/мутаций показываются **глобально** (`queryClient.ts` → `handleError` → toast + Sentry). В компоненте не дублируй тосты ошибок; для тихих запросов — `meta: { silent: true }`. Успех — `notifications.show({ color: "green", ... })` в месте вызова.
- `interceptors.ts` сам ставит `Authorization`, `X-Idempotency-Key` (для POST/PUT/PATCH) и обновляет токен на 401 — не делай этого вручную.
- Socket.IO (`services/socket.client.ts`) обновляет кэш React Query по событию `notification_status_updated`; подключается после логина.

## 3. UI (Mantine)

- Только компоненты Mantine и их style-props (`p`, `mt`, `gap`, `c`, `bg`), лэйауты `Stack` / `Group` / `Grid` / `SimpleGrid` / `Box`. **Без своих `.css` файлов и без CSS-in-JS библиотек.** (`src/index.css` — мусор шаблона Vite, не подключён.)
- Иконки — `@tabler/icons-react`.
- Даты — `@mantine/dates` + `dayjs`; формат отображения для сотрудника — `DD.MM.YYYY` / «11 декабря». Помни правило времени из [domain.md](./domain.md#время-и-даты-важно): никаких конвертаций часовых поясов.
- Деньги — компонент `MoneyInput`, целые тенге.
- **Мобильная версия обязательна**: сотрудники работают и с телефона. Таблицы на мобиле → карточки (см. пары `IssueDesktopTable` / `IssueMobileCards`, `CostumeDesktopTable` / `CostumeMobileCard`), брейкпоинт `useMediaQuery("(max-width: 768px)")`. Модалки на мобиле — `fullScreen`.
- Тексты интерфейса — на русском, короткие и операционные («Выдать костюмы», «Бирка написана»).
- Деструктивные действия — через `ConfirmDeleteModal`; операционные (бирка написана) — без подтверждения.
- Кнопки, отправляющие мутацию, — `loading={mutation.isPending}` (защита от дублей).

## 4. Формы

- Только `useForm` из `@mantine/form` + `schemaResolver(<Schema>)`; схема — из `@costumes/shared`.
- Вложенные списки (дети/заказы в брони) — `form.insertListItem` / `removeListItem`.
- Автоподсчёты (остаток, итоги) — вычисляй из `form.values` при рендере, не храни отдельно.

## 5. Состояние

- Серверные данные — **только React Query**. Не копируй их в Zustand или `useState`.
- Zustand — для глобального клиентского состояния (сейчас только `auth.store.ts` с `persist`).
- Локальное UI-состояние — `useState` / `useDisclosure`.

## 6. TypeScript и стиль

- `any` запрещён. `strict`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax` (используй `import type`).
- Только функциональные компоненты, именованные экспорты (`export function X` / `export const X`).
- Имена файлов компонентов — `PascalCase.tsx` (часть старых файлов в camelCase — при правке файла можно переименовать отдельным коммитом).
- ESLint: `eslint.config.js` (flat). `.eslintrc.cjs` — устаревший, не используется.
- Кавычки двойные (как в существующем коде).

## 7. Env

- `VITE_API_URL` — база API (`/api` в проде, `http://localhost:5000` локально).
- `VITE_SOCKET_URL` — база сокета (`/` в проде).
- `VITE_SENTRY_DSN` — DSN Sentry (в dev Sentry не инициализируется).

## 8. Проверки перед завершением задачи

```bash
cd apps/crm-frontend
pnpm exec tsc -b
pnpm lint
pnpm test
pnpm build   # перед крупными изменениями
```
UI-изменения проверяй в браузере на десктопной и мобильной ширине (375px).

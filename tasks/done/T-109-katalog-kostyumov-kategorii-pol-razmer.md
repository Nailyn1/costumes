# T-109 · Каталог костюмов: категории, пол, размер (backend + shared)

- **Приоритет:** high
- **Область:** Фичи
- **Создана:** 2026-10-25
- **Выполнена:** 2026-10-25
- **Эпик:** [T-032](./T-032-kategorii-i-foto-kostyumov.md)

## Контекст

Решения владельца — в эпике T-032. У костюма одна категория из двухуровневого справочника (основная → подкатегория), отдельно пол и размер. Все поля необязательные: ~500 существующих костюмов не заполняются.

## Что сделать

1. **Prisma** (новая миграция, не деструктивная):
   - `CostumeCategory`: `id`, `name`, `parentId?` (самоссылка, максимум 2 уровня), `sortOrder`, `createdAt`, `updatedAt`, `deletedAt`; уникальность имени среди активных внутри одного родителя.
   - `Costume`: `categoryId?` → `CostumeCategory`, `gender? CostumeGender` (`girl | boy | unisex`), `heightFrom? Int`, `heightTo? Int` (см), `sizeLabel? String`.
   - **Миграция данных** со стартовым справочником: «Национальные» → Кавказские, Татарские, Немецкие, Русские, Белорусские, Украинские, Казахские; «Новогодние» → Супергерои, Классические, Животные, Снеговики. Миграция идемпотентна по смыслу (на чистой и на прод-БД).
2. **TypeSpec / shared**:
   - справочник: `GET /costume-categories` (дерево), `POST` (основная или подкатегория), `PATCH /{id}` (имя, порядок), `DELETE /{id}` (soft; нельзя удалить категорию, у которой есть активные подкатегории — 409; костюмы удалённой категории остаются «без категории»);
   - в `Costume`/создании/изменении: `categoryId?`, `gender?`, `heightFrom?`, `heightTo?`, `sizeLabel?` (валидация: `heightFrom ≤ heightTo`, рост 50–200, `sizeLabel` ≤ 20 символов);
   - в ответах поиска/списка/выбора костюма — `category { id, name, parentName? }`, `gender`, размер;
   - фильтры в `GET /costumes/list`, `/costumes/search`, `/costumes/search-available`: `categoryId` (основная категория включает подкатегории), `gender`, `height` (рост ребёнка попадает в диапазон), `withoutCategory`.
3. **Backend**: сервис справочника, soft delete во всех выборках, валидация подкатегории (нельзя сделать подкатегорию у подкатегории), фильтры поиска с сохранением текущего ранжирования (`search.utils`, правило «точные совпадения отдельным запросом» из backend.md).
4. **Документация**: `.agents/domain.md` §1 (сущности), §4.6 (страница костюмов).

## Критерии готовности

- [x] Миграция создана через `prisma migrate dev`, SQL просмотрен, стартовый справочник есть в БД.
- [x] API справочника и новые поля костюма в shared, backend и frontend typecheck зелёные (фронт пока только компилируется — UI в T-113).
- [x] Фильтры поиска работают и не ломают ранжирование.
- [x] Unit-тесты сервиса справочника и фильтров; integration-сценарий: создать подкатегорию → костюм в ней → найти фильтром по основной категории.
- [x] `.agents/domain.md` обновлён.

## План

1. Prisma: `CostumeCategory`, поля каталога у `Costume`, enum `CostumeGender`; миграция `--create-only` + SQL стартового справочника.
2. TypeSpec: новый модуль `costume-categories.tsp` (отдельный файл — меньше конфликтов с T-111), поля и фильтры в `costumes.tsp`; gen → экспорты → build.
3. Backend: `CostumeCategoriesService/Controller`, `costume.mapper.ts`, `costume-filters.ts`, расширение `CostumesService`.
4. Тесты: unit (категории, фильтры, сервис костюмов), integration `costume-catalog.int-spec.ts`.
5. Документация `.agents/domain.md`, `shared-api.md`, `backend.md`.

## Результат

Сделано:
- Миграция `20261025040200_costume_catalog` (не деструктивная): таблица `costume_categories`, колонки каталога у `costumes`, enum `CostumeGender`, идемпотентный стартовый справочник (2 основные + 11 подкатегорий). Проверена на копии прод-данных (521 костюм, остались без изменений).
- API: `/costume-categories` (GET дерево, POST, PATCH, DELETE) и новые поля/фильтры (`categoryId`, `gender`, `height`, `withoutCategory`) в `/costumes/list|search|search-available`; `category/gender/heightFrom/heightTo/sizeLabel` в ответах по костюму (необязательные и nullable — старые клиенты и моки не ломаются).
- Решения по деталям (сверить с владельцем при ревью): уникальность имён — проверкой в сервисе, без индекса БД (NULL-родитель); одна граница роста = «ровно этот рост»; удаление категории обнуляет `categoryId` у костюмов; в ответах `/costumes/{id}/availability` тоже есть поля каталога.
- Тесты: unit 379, integration 87 (в т.ч. новый `costume-catalog.int-spec.ts`), frontend 235 — зелёные; typecheck backend/frontend, lint frontend и изменённых файлов backend чистые (в backend остались старые prettier-ошибки в `redis/redis.idempotency*`, не из этой задачи).
- UI не менялся (интерфейс — T-113), ручная проверка в браузере не требовалась.
- Коммит: ветка `claude/costume-catalog-966799`, `feat(back): add costume categories, gender and size`.

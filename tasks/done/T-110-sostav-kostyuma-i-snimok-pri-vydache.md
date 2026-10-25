# T-110 · Состав костюма и снимок при выдаче (backend + shared)

- **Приоритет:** high
- **Область:** Фичи
- **Создана:** 2026-10-25
- **Выполнена:** 2026-10-25
- **Эпик:** [T-032](./T-032-kategorii-i-foto-kostyumov.md)
- **После:** [T-109](./T-109-katalog-kostyumov-kategorii-pol-razmer.md) (те же файлы — делать тем же исполнителем следом)

## Контекст

Решения владельца — в эпике T-032. В составе только то, что можно потерять или забыть положить (головной убор, накидка, повязка, фартук, саукеле, пояс…), основа костюма не указывается. Выдача — только подсказка «Положить в пакет», без чекбоксов. Возврат — все части отмечены по умолчанию, снятые части фиксируются **только записью в истории визита**, возврат не блокируется и денег не начисляет.

## Что сделать

1. **Prisma** (новая миграция): `Costume.parts Json @default("[]")`; `Order.issuedParts Json?` — снимок состава на момент выдачи.
2. **shared**:
   - модель `CostumePart { name: string (1..40), qty: int32 (1..20) }`, `parts: CostumePart[]` (до 20 частей, имена без дублей без учёта регистра) в создании/изменении/ответах костюма;
   - константа подсказок `COSTUME_PART_SUGGESTIONS` (Головной убор, Накидка, Повязка, Фартук, Саукеле, Пояс, Жилет, Корона, Маска, Крылья) и `DEFAULT_COSTUME_PARTS = [{ name: "Головной убор", qty: 1 }]` — экспорт из `shared/src/costumes.ts`;
   - в ответах выдачи (`for-issue`, быстрая выдача, add-and-issue превью), возврата (`for-return`) и карточки визита — части заказа: для выдачи — текущий `costume.parts`, для возврата/карточки — `issuedParts` (если снимка нет у старых заказов — текущий `costume.parts`);
   - в `POST /visits/:id/complete-return` — необязательное `missingParts: { orderId, parts: string[] }[]`.
3. **Backend**:
   - чтение `parts` через Zod-схему (мусор в JSON не должен ронять ответ — пустой список + warning в лог);
   - снимок `issuedParts` пишется атомарно в командах выдачи: обычная выдача, быстрая выдача (T-036), add-and-issue (T-096); `unissue` снимок не стирает (повторная выдача перезапишет);
   - `complete-return` с `missingParts`: проверка, что заказы принадлежат визиту и части есть в снимке; событие `AuditEvent` визита (`action` вида `return_missing_parts`, payload — заказ, костюм, части), в той же транзакции; без `missingParts` поведение прежнее.
4. **Документация**: `.agents/domain.md` — состав, снимок, правило возврата; описание события истории.

## Критерии готовности

- [x] Миграция не деструктивна, старые заказы без снимка корректно отдают текущий состав.
- [x] Снимок пишется во всех трёх командах выдачи (unit + integration).
- [x] Возврат с недостающими частями пишет событие истории, без них — как раньше; ошибочные `orderId`/части → 400.
- [x] `pnpm test`, `pnpm test:int`, typecheck и lint зелёные.
- [x] `.agents/domain.md` обновлён.

## План

1. Prisma: `Costume.parts Json @default("[]")`, `Order.issuedParts Json?` (миграция не деструктивная).
2. TypeSpec/shared: `CostumePart`, `parts` в костюме и запросах, `parts` у заказов выдачи/возврата/карточки, `missingParts` в `complete-return`, событие истории `return.missing_parts`; ручной `shared/src/costume-parts.ts` (константы, нормализация, дубли).
3. Backend: безопасное чтение состава, снимок в трёх командах выдачи, `missingParts` в возврате.
4. Тесты: unit + integration; docs.

## Результат

Сделано:
- Миграция `20261025041520_costume_parts`: `costumes.parts JSONB NOT NULL DEFAULT '[]'`, `orders.issued_parts JSONB NULL`.
- Shared: `CostumePart`, `COSTUME_PART_SUGGESTIONS`, `DEFAULT_COSTUME_PARTS`, `normalizeCostumeParts`, `findDuplicateCostumePart`, `isSameCostumePartName` (экспорт из `@costumes/shared`); `parts?` в `Costume`, `VisitOrder` (выдача), `VisitReturnOrder`, `VisitReadOrder`; `missingParts?` в `CompleteReturnRequest`; действие истории `return.missing_parts`.
- Снимок `issuedParts` пишется в обычной выдаче, быстрой выдаче и add-and-issue; `unissue` его не стирает, повторная выдача перезаписывает.
- `complete-return` с `missingParts`: проверки заказа/частей/дублей (400) до записи, событие истории на заказ в той же транзакции и группе команды; без `missingParts` — как раньше.
- Фронтенд: только отображение «Вернули без: …» в истории визита (`visitHistory.ts` + тест), чтобы новое действие истории не падало и было видно; остальной UI — T-113/T-114.
- Решения по деталям (проверить при ревью): событие `return.missing_parts` — по одному на заказ (entity = order); названия частей сверяются без учёта регистра и пишутся в историю в написании состава; `parts` в ответах опциональные (старые клиенты/моки не ломаются); новый костюм без `parts` получает пустой состав, «Головной убор» подставляет только форма.
- Проверки: shared build, typecheck backend/frontend, lint frontend и изменённых файлов backend, unit backend 394 / frontend 236, integration 92 — зелёные. Ручной проверки UI нет (UI в T-113/T-114).
- Коммит: `feat(back): add costume parts and issued snapshot`.

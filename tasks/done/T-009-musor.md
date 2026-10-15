# T-009 · Мусор

- **Приоритет:** medium — желательно до сезона
- **Область:** Инфраструктура и гигиена репозитория
- **Создана:** 2026-10-15
- **Выполнена:** 2026-10-15

## Контекст

удалить `apps/crm-frontend/.eslintrc.cjs`, `src/index.css`, шаблонные README в apps; `shared/api-spec/package.json` (дубль зависимостей); зафиксировать версии `@typespec/*` вместо `latest`.

## Критерии готовности

- [x] удалены `apps/crm-frontend/.eslintrc.cjs` (легаси; рабочий конфиг — `eslint.config.js`) и `apps/crm-frontend/src/index.css` (нигде не импортировался)
- [x] удалены шаблонные `apps/backend/README.md` и `apps/crm-frontend/README.md`
- [x] удалён `shared/api-spec/package.json` — `npm run gen:api` без него отрабатывает, `src/openapi-client.ts` не изменился
- [x] `@typespec/*` в `shared/package.json` зафиксированы на установленных версиях
- [x] shared build, backend `tsc`, frontend `tsc -b` + `vite build` проходят

## Результат

`@typespec/compiler` 1.10.0, `http` / `openapi` / `openapi3` 1.9.0, `rest` 0.79.0 (точные версии, без `^`). `package-lock.json` синхронизирован (позже удаляется в T-002).

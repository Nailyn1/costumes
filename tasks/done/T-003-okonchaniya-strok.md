# T-003 · Окончания строк

- **Приоритет:** high — до сезона обязательно
- **Область:** Инфраструктура и гигиена репозитория
- **Создана:** 2026-10-15
- **Выполнена:** 2026-10-15

## Контекст

`.gitattributes` (`* text=auto eol=lf`), `endOfLine: 'lf'` в prettier, перенормализация файлов. Сейчас backend lint: ~379 ошибок, почти все `␍`.

## Критерии готовности

- [x] `.gitattributes` с `* text=auto eol=lf` и binary-исключениями
- [x] `endOfLine: "lf"` в `apps/backend/.prettierrc`; правило `prettier/prettier` в ESLint backend больше не переопределяет его на `auto`
- [x] В индексе все файлы уже LF (`git add --renormalize .` не дал изменений), рабочая копия приводится к LF при checkout
- [x] `eslint` backend не выдаёт ошибок `␍`
- [x] Фронтенд: prettier-конфига нет, ESLint-правил про окончания строк нет — менять нечего

## Результат

- Добавлен `.gitattributes`; в `apps/backend/.prettierrc` — `endOfLine: "lf"`; в `eslint.config.mjs` правило стало `'prettier/prettier': 'error'` (раньше `{ endOfLine: 'auto' }` маскировало CRLF). Массового переформатирования нет: в индексе уже был LF, дифф кода пустой.
- Для уже существующего клона/worktree с CRLF в рабочей копии: пересоздать файлы командой `git rm --cached -r -q . && git reset --hard` либо создать worktree заново (`eol=lf` в `.gitattributes` приоритетнее `core.autocrlf=true`).
- Оставшиеся НЕ-␍ замечания `eslint` backend (не чинились):
  - `src/common/pipes/zod-validation.pipe.ts:34` — error `@typescript-eslint/no-unsafe-return`;
  - `src/main.ts:34` — warning `@typescript-eslint/no-floating-promises`;
  - `test/app.e2e-spec.ts` — parsing error: файл не входит в `tsconfig.json` (`parserOptions.project`).
- Frontend lint: 1 warning (неиспользуемая `eslint-disable` директива в `WhatsAppButton.tsx:63`).

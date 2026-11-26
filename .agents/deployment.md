# Production: pupavka.site

## 1. Паспорт VPS

Данные предоставлены владельцем 2026-11-25; настройка сервера и восстановление БД ещё требуют проверки.

| Параметр | Значение |
|---|---|
| IPv4 | `185.100.66.194` |
| ОС | Ubuntu 24.04 LTS |
| SSH | `ssh costumes`, пока пользователь `root` |
| Домен | `pupavka.site`, DNS и прокси Cloudflare |
| Приложение | `/var/www/costumes` |
| HTTPS | Nginx **в контейнере frontend**, порты 80/443 |
| База / очередь | PostgreSQL 15 / Redis 7, только внутренняя сеть Compose |

Не хранить здесь пароли, токены, приватные ключи и дампы. Личный SSH-ключ владельца защищён паролем; CI нужен отдельный ключ. Доступ `root` — исходное состояние, передача деплоя отдельному пользователю возможна после проверки его доступа к Docker и каталогу проекта. Группа Docker даёт права, эквивалентные root.

## 2. Иерархия файлов

```text
/var/www/costumes/                    # git checkout main, compose project costumes
├── docker-compose.yaml              # конфигурация production
├── .env                             # только на VPS, chmod 600
├── apps/, shared/, .github/, ...     # исходники; на VPS сборка не нужна
└── .git/
/etc/nginx/ssl/pupavka.site/          # вне репозитория, каталог 700
├── origin.pem                       # Cloudflare Origin Certificate, 644
└── origin.key                       # приватный ключ, 600
/var/backups/costumes/               # дампы/копии перед миграциями, каталог 700
/var/lib/docker/volumes/             # управляется Docker, вручную не менять
```

Compose монтирует каталог сертификатов в `/etc/nginx/certs` контейнера **read-only**; имена внутри — `origin.pem`, `origin.key`. При отсутствии каталога Compose завершится ошибкой, а не создаст пустой каталог. Новый сертификат не требуется, если текущий действителен, покрывает `pupavka.site` и соответствует ключу.

Данные БД — named volume `costumes_pg_data`, Redis — `costumes_redis_data` (при запуске из `/var/www/costumes` без переопределения имени проекта). Не менять имя проекта после восстановления. Не выполнять `docker compose down -v`: это удалит данные.

Nginx на хосте устанавливать не нужно. Если он уже установлен и занимает 80/443, сначала проверить, какие сайты обслуживает; останавливать только если он не нужен другим сервисам.

## 3. Проверка VPS и HTTPS

Следующие команды выполняет владелец на VPS, начиная с `ssh costumes`. Они не запускают приложение и миграции.

```bash
cat /etc/os-release
docker --version
docker compose version
ss -lntp | grep -E ':(22|80|443|5432|6379)\b' || true
systemctl is-active nginx || true
install -d -m 755 /var/www/costumes
install -d -m 700 /var/backups/costumes
stat -c '%a %U:%G %n' /etc/nginx/ssl/pupavka.site /etc/nginx/ssl/pupavka.site/origin.{pem,key}
openssl x509 -in /etc/nginx/ssl/pupavka.site/origin.pem -noout -subject -issuer -dates -ext subjectAltName
openssl x509 -in /etc/nginx/ssl/pupavka.site/origin.pem -checkend 0 -noout
openssl x509 -in /etc/nginx/ssl/pupavka.site/origin.pem -pubkey -noout | openssl pkey -pubin -outform DER | sha256sum
openssl pkey -in /etc/nginx/ssl/pupavka.site/origin.key -pubout -outform DER | sha256sum
```

Последние две суммы должны совпасть. Приватный ключ команды не выводят. Если требуется, установить владельца `root:root`, каталог 700, ключ 600 и сертификат 644. Не загружать ключ в git или чат.

Docker устанавливать по [официальной инструкции для Ubuntu](https://docs.docker.com/engine/install/ubuntu/), включая Compose plugin. На VPS и у провайдера разрешить входящие TCP 22, 80, 443. До включения firewall убедиться, что SSH разрешён, и сохранить открытую SSH-сессию. PostgreSQL, Redis и backend наружу не публикуются. Redis Insight запускается только явно через профиль `tools`, портов наружу у него нет.

В Cloudflare проверить A-запись `@ → 185.100.66.194`, Proxied; убрать устаревшую AAAA-запись, если на новом сервере IPv6 не настроен. Включить SSL/TLS **Full (strict)**. Публичный DNS при включённом прокси вернёт IP Cloudflare; фактический origin проверять в панели Cloudflare. Origin CA работает для соединения Cloudflare → VPS; браузер напрямую ему не доверяет. См. [Origin CA](https://developers.cloudflare.com/ssl/origin-configuration/origin-ca/) и [Full (strict)](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/).

## 4. Репозиторий и окружение

Если `/var/www/costumes` пустой:

```bash
git clone --branch main https://github.com/Nailyn1/costumes.git /var/www/costumes
cd /var/www/costumes
git status --short
```

Для приватного репозитория настроить read-only deploy key для GitHub. Не помещать токен в URL remote. Пока инфраструктурный коммит не в `main`, checkout на сервере содержит старые настройки; не запускать старый compose. Подготовить целевую ревизию отдельно либо дождаться подготовленного релиза. Перед первым merge в `main` отключить workflow Deploy to Production в GitHub Actions, если сервер ещё не готов: push в `main` автоматически запускает миграции. После подготовки включить workflow и повторно запустить workflow нужного SHA `main`.

Корневой `.env` создать вручную по [setup.md](./setup.md#2-переменные-окружения) и локальному `.env.example` (если он есть). Не копировать локальные dev-секреты вслепую.

- `NODE_ENV=production`, `CLIENT_URL=https://pupavka.site`, `SERVER_URL=https://pupavka.site`, `SERVER_DOMAIN=pupavka.site`.
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`: имя целевой БД для восстановления. Для встроенного в Compose URL пароль должен быть URL-safe, например случайный hex. `DATABASE_URL` и `REDIS_URL` контейнера задаёт Compose; не оставлять dev `REDIS_HOST=localhost` (если задаётся — `redis`).
- `JWT_SECRET`: длинный случайный секрет.
- `GREEN_API_URL`, `GREEN_API_ID_INSTANCE`, `GREEN_API_TOKEN`, `GREEN_API_WEBHOOK_TOKEN`.
- `S3_ENDPOINT=https://object.pscloud.io`, `S3_REGION=us-east-1`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET_PUBLIC`, `S3_PUBLIC_BASE_URL=https://<бакет>.object.pscloud.io`, `S3_FORCE_PATH_STYLE=false`.
- `SENTRY_DSN` — при использовании Sentry. Seed-переменные нужны только при создании сотрудников; при восстановленной БД seed автоматически не запускать.

```bash
chmod 600 /var/www/costumes/.env
cd /var/www/costumes
export COMPOSE_FILE=docker-compose.yaml
docker compose config --quiet
```

Не публиковать вывод `docker compose config` без `--quiet`: он раскрывает секреты. `COMPOSE_FILE=docker-compose.yaml` исключает автоматическое подключение локального `docker-compose.override.yml`; на VPS такой файл не нужен. При новой SSH-сессии снова задать `COMPOSE_FILE` перед командами ниже.

## 5. Восстановление и миграции

Сначала сохранить исходный дамп отдельно и отрепетировать восстановление и миграции на его изолированной копии. Уточнить формат (`file /путь/backup` или `pg_restore --list`), версию PostgreSQL источника и наличие `_prisma_migrations`. Дамп с `CREATE DATABASE`/`\connect` требует отдельного сценария — команды ниже рассчитаны на дамп одной БД без переключения подключения. Восстановление выполняется только в новую пустую целевую БД.

**Не запускать приложение до восстановления.** В подготовленной ревизии Compose:

```bash
cd /var/www/costumes
export COMPOSE_FILE=docker-compose.yaml
docker compose up -d --wait postgres redis
```

Выбрать **один** вариант после проверки формата (подставить реальный путь):

```bash
# Plain SQL, без CREATE DATABASE / \connect:
docker compose exec -T postgres sh -c 'exec psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < /var/backups/costumes/backup.sql
# Custom pg_dump; роли/права прежнего VPS не восстанавливаем:
docker compose exec -T postgres sh -c 'exec pg_restore --exit-on-error --no-owner --no-privileges -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < /var/backups/costumes/backup.dump
```

После восстановления сравнить количество клиентов, детей, костюмов, визитов и заказов с исходным дампом. Перед миграциями сделать новый дамп:

```bash
umask 077
docker compose exec -T postgres sh -c 'exec pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > /var/backups/costumes/before-migrations.dump
test -s /var/backups/costumes/before-migrations.dump
```

Скопировать его за пределы VPS. Проверить дубли активных телефонов перед `unique_active_client_phone`. Миграция `remove_costume_status` удаляет колонку: до применения на восстановленной production-БД требуется согласие владельца и успешная репетиция. При отсутствии истории Prisma не делать `migrate resolve` наугад; сначала сверить фактическую схему с историей миграций.

## 6. CI/CD и первый запуск

GitHub Secrets: `SERVER_IP=185.100.66.194`, `SERVER_USER=root` (пока используется root), `SSH_PRIVATE_KEY` — отдельный ключ CI, `DOCKER_USERNAME`, `DOCKER_PASSWORD`. Текущий workflow не передаёт passphrase: личный ключ владельца с паролем для него не подходит. Публичный CI-ключ добавить отдельной строкой в `authorized_keys`, не заменять рабочий ключ владельца. Лишние некорректные строки удалять только после резервной копии файла и проверки второго SSH-подключения.

Образы собираются в Actions и публикуются в Docker Hub (`nailyn1/costumes-backend`, `nailyn1/costumes-frontend`). Если они приватные, на VPS нужен `docker login` через access token. Сборка на VPS не нужна. Сервер сохраняет git checkout: workflow обновляет его fast-forward до точного SHA релиза и проверяет HEAD. Локальных правок отслеживаемых файлов на сервере быть не должно. `.env` и сертификаты workflow не пересылает.

Перед merge: сервер/сертификаты/env/БД готовы, репетиция миграций успешна, деструктивные изменения согласованы. Если это ещё не так — workflow должен оставаться отключённым. PR и merge выполняются по отдельному решению владельца.

При push в `main` workflow:

1. Проверяет код и публикует образы с тегом SHA.
2. Обновляет `/var/www/costumes` до этого SHA, проверяет сертификаты и Compose.
3. Скачивает образы и ждёт готовности PostgreSQL/Redis.
4. Выполняет `prisma migrate deploy` в одноразовом backend-контейнере. При ошибке останавливается.
5. Обновляет backend, проверяет `nginx -t`, обновляет frontend.

Запуски workflow сериализованы, чтобы два деплоя не меняли сервер одновременно. Деплой не является атомарным: на обновлениях старый backend работает до завершения миграций, поэтому миграции должны быть совместимы с работающим кодом либо требуется согласованное окно обслуживания. Автоматического отката схемы нет.

Для ручного первого запуска **после опубликования образов**:

```bash
cd /var/www/costumes
export COMPOSE_FILE=docker-compose.yaml
export IMAGE_TAG=<полный-SHA-релиза>
docker compose pull backend frontend postgres redis
docker compose up -d --wait postgres redis
docker compose run --rm --no-deps backend ./node_modules/.bin/prisma migrate deploy
# Продолжать только при успешной миграции:
docker compose up -d backend
docker compose run --rm --no-deps frontend nginx -t
# Продолжать только при успешной проверке:
docker compose up -d frontend
docker compose ps
docker compose logs --tail=100 backend frontend
curl -I https://pupavka.site
```

Проверить вход, поиск клиента, визит, выдачу/возврат, Socket.IO и загрузку фото. Пока T-112…T-114 не влиты, интерфейс фото в релиз не входит. Green API: webhook `https://pupavka.site/api/webhooks/whatsapp`, токен должен совпадать с `.env`; проверить авторизацию инстанса и тестовое уведомление. Проверить публичное чтение фото из S3. Настроить внешние ежедневные бэкапы до работы с живыми данными ([T-012](../tasks/backlog/T-012-bekapy-bd-v-s3.md)).

При замене сертификата перезапустить frontend: `docker compose restart frontend`. Откат образов описан в [architecture.md](./architecture.md#4-инфраструктура-и-деплой); Compose и образ frontend должны оставаться совместимыми по путям сертификатов. Миграции автоматически не откатываются.

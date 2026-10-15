FROM node:22-alpine AS builder

RUN apk add --no-cache openssl
RUN corepack enable

WORKDIR /app

COPY . .
RUN pnpm install --frozen-lockfile

RUN pnpm --filter @costumes/shared build

WORKDIR /app/apps/backend
RUN pnpm exec prisma generate
RUN pnpm build

# Прод-зависимости backend (+ shared) в отдельную папку
WORKDIR /app
RUN pnpm --filter @costumes/backend --config.inject-workspace-packages=true deploy --prod /prod/backend

FROM node:22-alpine AS production

RUN apk add --no-cache openssl

WORKDIR /app/apps/backend

COPY --from=builder /prod/backend/package.json ./
COPY --from=builder /prod/backend/node_modules ./node_modules
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/prisma ./prisma
COPY --from=builder /app/apps/backend/prisma.config.ts ./

EXPOSE 5000

CMD ["node", "dist/main.js"]

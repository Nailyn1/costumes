FROM node:20-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /app

COPY . .
RUN npm install

WORKDIR /app/apps/backend
RUN npx prisma generate
RUN npm run build

WORKDIR /app
RUN npm prune --omit=dev

FROM node:20-alpine AS production

RUN apk add --no-cache openssl

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

COPY --from=builder /app/shared ./shared

COPY --from=builder /app/apps/backend ./apps/backend

EXPOSE 5000

CMD ["node", "apps/backend/dist/main.js"]
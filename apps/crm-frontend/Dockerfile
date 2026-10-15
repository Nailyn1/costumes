FROM node:22-alpine AS builder

RUN corepack enable

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @costumes/shared build

WORKDIR /app/apps/crm-frontend
RUN pnpm build

FROM nginx:alpine AS production

RUN rm /etc/nginx/conf.d/default.conf

COPY apps/crm-frontend/nginx.conf /etc/nginx/conf.d/

COPY --from=builder /app/apps/crm-frontend/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

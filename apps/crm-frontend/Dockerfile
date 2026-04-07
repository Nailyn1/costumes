FROM node:20-alpine AS builder

WORKDIR /app

COPY . .

RUN npm install

WORKDIR /app/apps/crm-frontend
RUN npm run build

FROM nginx:alpine AS production

RUN rm /etc/nginx/conf.d/default.conf

COPY apps/crm-frontend/nginx.conf /etc/nginx/conf.d/

COPY --from=builder /app/apps/crm-frontend/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
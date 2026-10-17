import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';

export const httpServer = (app: INestApplication) => app.getHttpServer() as App;

/** Логин тестовым сотрудником; возвращает accessToken. */
export async function login(
  app: INestApplication,
  user: { login: string; password: string },
): Promise<string> {
  const res = await request(httpServer(app))
    .post('/auth/login')
    .send(user)
    .expect(201);
  return (res.body as { accessToken: string }).accessToken;
}

/** supertest-обёртка, подставляющая Bearer-токен. */
export function authed(app: INestApplication, token: string) {
  const bearer = `Bearer ${token}`;
  const server = httpServer(app);
  return {
    get: (url: string) => request(server).get(url).set('Authorization', bearer),
    post: (url: string) =>
      request(server).post(url).set('Authorization', bearer),
    patch: (url: string) =>
      request(server).patch(url).set('Authorization', bearer),
    delete: (url: string) =>
      request(server).delete(url).set('Authorization', bearer),
  };
}

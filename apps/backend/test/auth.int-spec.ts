import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { TestApp, createTestApp } from './support/test-app';
import { httpServer } from './support/http';

describe('auth HTTP flow (integration)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.close();
  });

  const cookieFrom = (response: { headers: Record<string, unknown> }) => {
    const header = response.headers['set-cookie'] as string[] | undefined;
    expect(header).toBeDefined();
    const cookie = header?.find((value) => value.startsWith('refreshToken='));
    expect(cookie).toBeDefined();
    return cookie as string;
  };

  it('validates login length before looking up credentials', async () => {
    const result = await request(httpServer(t.app))
      .post('/auth/login')
      .send({ login: 'short', password: 'short' })
      .expect(400);
    expect(JSON.stringify(result.body)).toContain('Validation failed');
  });

  it('login, protected route, refresh and logout', async () => {
    const server = httpServer(t.app);
    const first = await request(server)
      .post('/auth/login')
      .send(t.user)
      .expect(201);
    const access1 = (first.body as { accessToken: string }).accessToken;
    const cookie1 = cookieFrom(first);
    expect(cookie1).toContain('HttpOnly');
    expect(cookie1).toMatch(/SameSite=Lax/i);
    expect(cookie1).not.toContain('Secure');
    await request(server)
      .get('/visits/reserved')
      .set('Authorization', `Bearer ${access1}`)
      .expect(200);

    const refreshed = await request(server)
      .post('/auth/refresh')
      .set('Cookie', cookie1)
      .expect(201);
    const access2 = (refreshed.body as { accessToken: string }).accessToken;
    const cookie2 = cookieFrom(refreshed);
    expect(access2).toBeTruthy();
    await request(server)
      .get('/visits/reserved')
      .set('Authorization', `Bearer ${access2}`)
      .expect(200);

    const logout = await request(server)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${access2}`)
      .set('Cookie', cookie2)
      .expect(204);
    expect(cookieFrom(logout)).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/i);
    await request(server)
      .post('/auth/refresh')
      .set('Cookie', cookie2)
      .expect(401);
  });

  it('rejects absent, malformed and expired refresh cookies', async () => {
    const server = httpServer(t.app);
    await request(server).post('/auth/refresh').expect(401);
    await request(server)
      .post('/auth/refresh')
      .set('Cookie', 'refreshToken=not-a-jwt')
      .expect(401);
    const jwt = t.app.get(JwtService);
    const user = await t.prisma.user.findUniqueOrThrow({
      where: { login: t.user.login },
    });
    const expired = await jwt.signAsync(
      { id: user.id, login: user.login },
      { expiresIn: -1 },
    );
    await request(server)
      .post('/auth/refresh')
      .set('Cookie', `refreshToken=${expired}`)
      .expect(401);
  });

  it('rejects expired access and unauthenticated protected routes', async () => {
    const server = httpServer(t.app);
    const jwt = t.app.get(JwtService);
    const user = await t.prisma.user.findUniqueOrThrow({
      where: { login: t.user.login },
    });
    const expired = await jwt.signAsync(
      { id: user.id, login: user.login },
      { expiresIn: -1 },
    );
    await request(server)
      .get('/visits/reserved')
      .set('Authorization', `Bearer ${expired}`)
      .expect(401);
    for (const route of [
      '/visits/reserved',
      '/visits/not_written',
      '/visits/issued-for-return',
    ]) {
      await request(server).get(route).expect(401);
    }
  });
});

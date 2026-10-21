import { CallHandler, ExecutionContext } from '@nestjs/common';
import Redis from 'ioredis';
import { of } from 'rxjs';
import { IdempotencyInterceptor } from './redis.idempotency';

describe('IdempotencyInterceptor', () => {
  const request = {
    method: 'POST',
    url: '/visits',
    headers: { 'x-idempotency-key': 'request-1' },
    body: { clientId: 1 },
  };
  const response = { status: jest.fn(), setHeader: jest.fn() };
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
  const next = { handle: () => of({ id: 1 }) } as CallHandler;

  it('reports an already running request in Russian', async () => {
    const redis = {
      get: jest.fn().mockResolvedValue(
        JSON.stringify({ status: 'processing' }),
      ),
    } as unknown as Redis;

    await expect(
      new IdempotencyInterceptor(redis).intercept(context, next),
    ).rejects.toThrow('Запрос с этим ключом уже обрабатывается');
  });

  it('reports a different body for a reused key in Russian', async () => {
    const redis = {
      get: jest.fn().mockResolvedValue(
        JSON.stringify({ status: 'completed', requestHash: 'old' }),
      ),
    } as unknown as Redis;

    await expect(
      new IdempotencyInterceptor(redis).intercept(context, next),
    ).rejects.toThrow('Ключ запроса уже использован с другими данными');
  });

  it('reports concurrent requests in Russian', async () => {
    const redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(null),
    } as unknown as Redis;

    await expect(
      new IdempotencyInterceptor(redis).intercept(context, next),
    ).rejects.toThrow('Запрос с этим ключом уже обрабатывается');
  });
});

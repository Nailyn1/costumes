import { UnauthorizedException } from '@nestjs/common';
import { WebhookTokenGuard } from './webhook-token.guard';

const makeGuard = (env: Record<string, string | undefined>) =>
  new WebhookTokenGuard({
    get: (key: string) => env[key],
  } as never);

const contextWith = (authorization?: string) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization } }),
    }),
  }) as never;

describe('WebhookTokenGuard', () => {
  const env = { GREEN_API_WEBHOOK_TOKEN: 's3cret-token' };

  it('accepts the request with the correct Bearer token', () => {
    expect(makeGuard(env).canActivate(contextWith('Bearer s3cret-token'))).toBe(
      true,
    );
  });

  it.each([
    ['no header', undefined],
    ['empty header', ''],
    ['wrong token', 'Bearer wrong'],
    ['token of a different length', 'Bearer s3cret-token-and-more'],
    ['no Bearer scheme', 's3cret-token'],
    ['Basic scheme', 'Basic s3cret-token'],
    ['empty Bearer', 'Bearer '],
  ])('rejects with 401: %s', (_name, header) => {
    expect(() => makeGuard(env).canActivate(contextWith(header))).toThrow(
      UnauthorizedException,
    );
  });

  it('does not leak details in the error response', () => {
    expect.assertions(2);
    try {
      makeGuard(env).canActivate(contextWith('Bearer wrong'));
    } catch (e) {
      expect((e as UnauthorizedException).message).toBe('Не авторизован');
      expect(
        JSON.stringify((e as UnauthorizedException).getResponse()),
      ).not.toContain('s3cret-token');
    }
  });

  describe('token is not configured', () => {
    it('rejects in production', () => {
      const guard = makeGuard({ NODE_ENV: 'production' });
      expect(() => guard.canActivate(contextWith('Bearer anything'))).toThrow(
        UnauthorizedException,
      );
      expect(() => guard.canActivate(contextWith())).toThrow(
        UnauthorizedException,
      );
    });

    it.each(['development', 'test', undefined])(
      'accepts when NODE_ENV=%s (warning only)',
      (nodeEnv) => {
        expect(
          makeGuard({ NODE_ENV: nodeEnv }).canActivate(contextWith()),
        ).toBe(true);
      },
    );
  });
});

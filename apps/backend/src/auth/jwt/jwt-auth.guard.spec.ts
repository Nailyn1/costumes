import { UnauthorizedException } from '@nestjs/common';
import { JwtRefreshGuard } from './jwt-auth.guard';

describe('JwtRefreshGuard', () => {
  const guard = new JwtRefreshGuard();

  it.each([
    ['missing user', null, false],
    ['expired token', new Error('jwt expired'), false],
  ])('returns a generic Russian 401 for %s', (_caseName, error, user) => {
    expect(() => guard.handleRequest(error, user)).toThrow(
      new UnauthorizedException('Недействительный токен обновления'),
    );
  });

  it('passes through an authenticated user', () => {
    const user = { id: 7, login: 'worker1' };
    expect(guard.handleRequest(null, user)).toBe(user);
  });
});

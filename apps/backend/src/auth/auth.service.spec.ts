import { UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { createPrismaMock } from '../test-utils';

jest.mock('argon2', () => ({ verify: jest.fn() }));

const { prisma, reset } = createPrismaMock();
const redis = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
const jwt = { signAsync: jest.fn() };
const verify = jest.mocked(argon2.verify);

describe('AuthService', () => {
  it.todo('T-085: return Russian refresh error messages');
  it.todo('T-086: issue a distinct refresh JWT even within the same second');
  let service: AuthService;
  let storedToken: string | undefined;

  beforeEach(() => {
    reset();
    storedToken = undefined;
    redis.get.mockImplementation(() => Promise.resolve(storedToken));
    redis.set.mockImplementation((_key: string, token: string) => {
      storedToken = token;
      return Promise.resolve('OK');
    });
    redis.del.mockImplementation(() => {
      storedToken = undefined;
      return Promise.resolve(1);
    });
    service = new AuthService(redis as never, jwt as never, prisma as never);
  });

  it('uses the same 401 response for an unknown login and wrong password', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 7, login: 'worker1', password: 'hash' });
    verify.mockResolvedValue(false);
    const credentials = { login: 'worker1', password: 'wrong-password-123' };
    const unknown = service.login(credentials);
    await expect(unknown).rejects.toThrow(
      new UnauthorizedException('Неверный логин или пароль'),
    );
    const wrongPassword = service.login(credentials);
    await expect(wrongPassword).rejects.toThrow(
      new UnauthorizedException('Неверный логин или пароль'),
    );
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('issues tokens with id and login and stores refresh with seven-day TTL', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 7,
      login: 'worker1',
      name: 'Сотрудник',
      password: 'hash',
    });
    verify.mockResolvedValue(true);
    jwt.signAsync
      .mockResolvedValueOnce('access-1')
      .mockResolvedValueOnce('refresh-1');
    const result = await service.login({
      login: 'worker1',
      password: 'correct-password',
    });
    expect(result).toEqual({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      user: { login: 'worker1', name: 'Сотрудник' },
    });
    expect(jwt.signAsync).toHaveBeenNthCalledWith(
      1,
      { id: 7, login: 'worker1' },
      { expiresIn: '15m' },
    );
    expect(jwt.signAsync).toHaveBeenNthCalledWith(
      2,
      { id: 7, login: 'worker1' },
      { expiresIn: '7d' },
    );
    expect(redis.set).toHaveBeenCalledWith('rf:7', 'refresh-1', 'EX', 604800);
  });

  it('rotates refresh and rejects the old token', async () => {
    storedToken = 'refresh-1';
    prisma.user.findUnique.mockResolvedValue({
      id: 7,
      login: 'worker1',
      name: 'Сотрудник',
    });
    jwt.signAsync
      .mockResolvedValueOnce('access-2')
      .mockResolvedValueOnce('refresh-2');
    await expect(service.refreshTokens(7, 'refresh-1')).resolves.toMatchObject({
      accessToken: 'access-2',
      refreshToken: 'refresh-2',
    });
    expect(redis.set).toHaveBeenCalledWith('rf:7', 'refresh-2', 'EX', 604800);
    await expect(service.refreshTokens(7, 'refresh-1')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it.each(['tampered', 'revoked'])(
    'rejects a %s refresh token',
    async (caseName) => {
      storedToken = caseName === 'revoked' ? undefined : 'valid-token';
      await expect(
        service.refreshTokens(
          7,
          caseName === 'tampered' ? 'other-token' : 'revoked-token',
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(jwt.signAsync).not.toHaveBeenCalled();
    },
  );

  it('rejects refresh when its user no longer exists', async () => {
    storedToken = 'refresh-1';
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.refreshTokens(7, 'refresh-1')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('deletes the refresh key on logout', async () => {
    storedToken = 'refresh-1';
    await service.logout(7);
    expect(redis.del).toHaveBeenCalledWith('rf:7');
    await expect(service.refreshTokens(7, 'refresh-1')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('sets secure cookies only in production', () => {
    const previous = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      expect(service.getCookieOptions()).toMatchObject({
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
      });
      process.env.NODE_ENV = 'test';
      expect(service.getCookieOptions()).toMatchObject({
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
      });
    } finally {
      process.env.NODE_ENV = previous;
    }
  });
});

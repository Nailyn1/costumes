import { WsException } from '@nestjs/websockets';
import { WsJwtGuard } from './ws-jwt.guard';

const jwt = { verifyAsync: jest.fn() };
const config = { get: jest.fn().mockReturnValue('test-secret') };

const contextFor = (client: {
  handshake: {
    auth?: Record<string, unknown>;
    headers: { authorization?: string };
  };
  user?: unknown;
}) => ({
  switchToWs: () => ({ getClient: () => client }),
});

describe('WsJwtGuard', () => {
  it.todo('T-085: return Russian WS authentication errors');
  let guard: WsJwtGuard;

  beforeEach(() => {
    jest.resetAllMocks();
    config.get.mockReturnValue('test-secret');
    guard = new WsJwtGuard(jwt as never, config as never);
  });

  it('rejects a socket without a token', async () => {
    const client = { handshake: { auth: {}, headers: {} } };
    await expect(
      guard.canActivate(contextFor(client) as never),
    ).rejects.toThrow(new WsException('Unauthorized: No token provided'));
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
  });

  it('rejects an invalid token', async () => {
    const client = { handshake: { auth: { token: 'bad' }, headers: {} } };
    jwt.verifyAsync.mockRejectedValue(new Error('invalid'));
    await expect(
      guard.canActivate(contextFor(client) as never),
    ).rejects.toThrow(new WsException('Unauthorized: Invalid token'));
  });

  it('accepts a handshake token and attaches the verified user', async () => {
    const client: {
      handshake: { auth: { token: string }; headers: Record<string, string> };
      user?: unknown;
    } = {
      handshake: { auth: { token: 'good' }, headers: {} },
    };
    const payload = { id: 7, login: 'worker1' };
    jwt.verifyAsync.mockResolvedValue(payload);
    await expect(guard.canActivate(contextFor(client) as never)).resolves.toBe(
      true,
    );
    expect(jwt.verifyAsync).toHaveBeenCalledWith('good', {
      secret: 'test-secret',
    });
    expect(client.user).toEqual(payload);
  });

  it('accepts a Bearer header if handshake auth is empty', async () => {
    const client = {
      handshake: { auth: {}, headers: { authorization: 'Bearer good' } },
    };
    jwt.verifyAsync.mockResolvedValue({ id: 7, login: 'worker1' });
    await expect(guard.canActivate(contextFor(client) as never)).resolves.toBe(
      true,
    );
    expect(jwt.verifyAsync).toHaveBeenCalledWith('good', {
      secret: 'test-secret',
    });
  });
});

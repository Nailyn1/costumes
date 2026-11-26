import { NotificationService } from '../notification.service';

describe('NotificationService.checkWhatsappAvailability', () => {
  const redis = { get: jest.fn(), set: jest.fn() };
  const provider = { checkWhatsapp: jest.fn() };
  const repository = { findClientIdsWithConfirmedWhatsapp: jest.fn() };
  const service = new NotificationService(
    redis as never,
    {} as never,
    provider as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    repository as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    redis.get.mockResolvedValue(null);
    redis.set.mockResolvedValue('OK');
    repository.findClientIdsWithConfirmedWhatsapp.mockResolvedValue(new Set());
  });

  it('uses confirmed delivery history without calling Green-API', async () => {
    repository.findClientIdsWithConfirmedWhatsapp.mockResolvedValue(
      new Set([7]),
    );
    await expect(
      service.checkWhatsappAvailability('+77071234567', false, 7),
    ).resolves.toBe('exists');
    expect(provider.checkWhatsapp).not.toHaveBeenCalled();
    expect(redis.get).not.toHaveBeenCalled();
  });

  it('caches a positive result without storing the phone in the key', async () => {
    provider.checkWhatsapp.mockResolvedValue(true);
    await expect(
      service.checkWhatsappAvailability('+77071234567'),
    ).resolves.toBe('exists');
    const key = (redis.set.mock.calls as unknown[][])[0][0] as string;
    expect(key).not.toContain('77071234567');
    expect(redis.set).toHaveBeenCalledWith(key, 'exists', 'EX', 3600);
    redis.get.mockResolvedValue('exists');
    await expect(
      service.checkWhatsappAvailability('+77071234567'),
    ).resolves.toBe('exists');
    expect(provider.checkWhatsapp).toHaveBeenCalledTimes(1);
  });

  it('bypasses cache on manual force and updates absent result', async () => {
    redis.get.mockResolvedValue('exists');
    provider.checkWhatsapp.mockResolvedValue(false);
    await expect(
      service.checkWhatsappAvailability('+77071234567', true, 7),
    ).resolves.toBe('absent');
    expect(
      repository.findClientIdsWithConfirmedWhatsapp,
    ).not.toHaveBeenCalled();
    expect(redis.get).not.toHaveBeenCalled();
    expect(provider.checkWhatsapp).toHaveBeenCalledWith('+77071234567', true);
  });

  it('returns unknown on provider error without caching it', async () => {
    provider.checkWhatsapp.mockRejectedValue(new Error('network error'));
    await expect(
      service.checkWhatsappAvailability('+77071234567'),
    ).resolves.toBe('unknown');
    expect(redis.set).not.toHaveBeenCalled();
  });
});

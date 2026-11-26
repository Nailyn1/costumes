import { of } from 'rxjs';
import { WhatsappProvider } from '../whatsapp.provider';

describe('WhatsappProvider.checkWhatsapp', () => {
  const http = { post: jest.fn() };
  const env: Record<string, string> = {
    GREEN_API_URL: 'https://example.green-api.test',
    GREEN_API_ID_INSTANCE: '1101',
    GREEN_API_TOKEN: 'secret',
  };
  const config = { get: jest.fn((key: string) => env[key]) };
  const provider = new WhatsappProvider(http as never, config as never);

  beforeEach(() => jest.clearAllMocks());

  it('sends a Kazakhstan chatId to the configured API host', async () => {
    http.post.mockReturnValue(of({ data: { existsWhatsapp: true } }));
    await expect(provider.checkWhatsapp('+77071234567')).resolves.toBe(true);
    expect(http.post).toHaveBeenCalledWith(
      'https://example.green-api.test/waInstance1101/checkWhatsapp/secret',
      { chatId: '77071234567@c.us', force: false },
    );
  });

  it('rejects an invalid answer instead of treating it as absent', async () => {
    http.post.mockReturnValue(of({ data: {} }));
    await expect(provider.checkWhatsapp('+77071234567')).rejects.toThrow(
      'Некорректный ответ',
    );
  });
});

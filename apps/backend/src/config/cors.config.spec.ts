import { getAllowedOrigins, socketCorsOrigin } from './cors.config';

describe('cors.config', () => {
  const saved = process.env.CLIENT_URL;
  afterEach(() => {
    if (saved === undefined) delete process.env.CLIENT_URL;
    else process.env.CLIENT_URL = saved;
  });

  const allowed = (origin: string | undefined) => {
    let result: boolean | undefined;
    socketCorsOrigin(origin, (_err, allow) => {
      result = allow;
    });
    return result;
  };

  it('includes CLIENT_URL and local dev origins', () => {
    process.env.CLIENT_URL = 'https://crm.example.kz';
    expect(getAllowedOrigins()).toEqual([
      'https://crm.example.kz',
      'http://localhost',
      'http://127.0.0.1',
      'http://localhost:80',
      'http://localhost:5173',
    ]);
  });

  it('skips an empty CLIENT_URL instead of adding undefined', () => {
    delete process.env.CLIENT_URL;
    expect(getAllowedOrigins()).not.toContain(undefined);
  });

  it('reads CLIENT_URL lazily (after .env is loaded)', () => {
    delete process.env.CLIENT_URL;
    expect(allowed('https://crm.example.kz')).toBe(false);
    process.env.CLIENT_URL = 'https://crm.example.kz';
    expect(allowed('https://crm.example.kz')).toBe(true);
  });

  it('allows listed origins and rejects foreign ones for Socket.IO', () => {
    process.env.CLIENT_URL = 'https://crm.example.kz';
    expect(allowed('http://localhost:5173')).toBe(true);
    expect(allowed('https://evil.example.com')).toBe(false);
  });

  it('allows requests without an Origin header (non-browser clients)', () => {
    expect(allowed(undefined)).toBe(true);
  });
});

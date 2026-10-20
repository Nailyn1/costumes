import 'reflect-metadata';
import { createServer, Server as HttpServer } from 'http';
import type { AddressInfo } from 'net';
import { Server } from 'socket.io';
import type { ServerOptions } from 'socket.io';
import { NotificationGateway } from '../notification.gateway';

// Берём настоящие опции из декоратора gateway и поднимаем Socket.IO с ними:
// проверяем, что CORS-политика сокета совпадает с HTTP (T-031).
describe('NotificationGateway CORS (T-031)', () => {
  let http: HttpServer;
  let io: Server;
  let url: string;
  const saved = process.env.CLIENT_URL;

  beforeAll(async () => {
    process.env.CLIENT_URL = 'https://crm.example.kz';
    const options = Reflect.getMetadata(
      'websockets:gateway_options',
      NotificationGateway,
    ) as Partial<ServerOptions>;
    http = createServer();
    io = new Server(http, options);
    await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    if (saved === undefined) delete process.env.CLIENT_URL;
    else process.env.CLIENT_URL = saved;
    await io.close();
  });

  const handshakeOrigin = async (origin: string) => {
    const res = await fetch(`${url}/socket.io/?EIO=4&transport=polling`, {
      headers: { Origin: origin },
    });
    return res.headers.get('access-control-allow-origin');
  };

  it('allows the CRM origin', async () => {
    await expect(handshakeOrigin('https://crm.example.kz')).resolves.toBe(
      'https://crm.example.kz',
    );
  });

  it('allows the local dev origin', async () => {
    await expect(handshakeOrigin('http://localhost:5173')).resolves.toBe(
      'http://localhost:5173',
    );
  });

  it('does not allow a foreign origin', async () => {
    await expect(
      handshakeOrigin('https://evil.example.com'),
    ).resolves.toBeNull();
  });
});

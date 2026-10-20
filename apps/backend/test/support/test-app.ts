import { INestApplication } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import Redis from 'ioredis';
import { AppModule } from '../../src/app.module';
import { PrismaClientExceptionFilter } from '../../src/common/filters/prisma-client-exception.filter';
import { SentryInterceptor } from '../../src/common/interceptors/sentry.interceptor';
import { ZodValidationPipe } from '../../src/common/pipes/zod-validation.pipe';
import { NotificationProcessor } from '../../src/notification/notification.processor';
import { WhatsappProvider } from '../../src/notification/whatsapp.provider';
import { PrismaService } from '../../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../../src/redis/redis.constants';

export interface TestApp {
  app: INestApplication;
  prisma: PrismaService;
  redis: Redis;
  /** Заглушка очереди `notifications`: jobs не уходят в Redis и не обрабатываются. */
  notificationQueue: { add: jest.Mock };
  whatsapp: {
    sendMessage: jest.Mock;
    getStateInstance: jest.Mock;
    checkWhatsapp: jest.Mock;
  };
  user: { login: string; password: string };
  close: () => Promise<void>;
}

/**
 * Поднимает настоящий AppModule in-process (без порта; supertest сам слушает
 * эфемерный порт). Заменены только внешние зависимости:
 *  - Redis — отдельная логическая БД (`REDIS_DB`), очищается при старте;
 *  - очередь BullMQ и её процессор — заглушки (иначе Worker читал бы реальную
 *    очередь из db 0 dev-Redis);
 *  - Green-API провайдер — мок.
 */
export async function createTestApp(): Promise<TestApp> {
  const redis = new Redis({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
    db: Number(process.env.REDIS_DB ?? 15),
  });
  await redis.flushdb();

  const notificationQueue = { add: jest.fn().mockResolvedValue({}) };
  const whatsapp = {
    sendMessage: jest.fn(),
    checkWhatsapp: jest.fn().mockResolvedValue(true),
    // вызывается на старте (NotificationService.onModuleInit)
    getStateInstance: jest.fn().mockResolvedValue('authorized'),
  };

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    // тихий логгер: иначе pino-pretty печатает каждый HTTP-запрос
    .overrideProvider('pino-params')
    .useValue({ pinoHttp: { level: 'silent' } })
    .overrideProvider(REDIS_CLIENT)
    .useValue(redis)
    .overrideProvider(getQueueToken('notifications'))
    .useValue(notificationQueue)
    .overrideProvider(NotificationProcessor)
    .useValue({})
    .overrideProvider(WhatsappProvider)
    .useValue(whatsapp)
    .compile();

  const app = moduleRef.createNestApplication();
  // Держать в синхроне с bootstrap() в src/main.ts (CORS и логгер тестам не нужны).
  app.use(cookieParser());
  app.useGlobalInterceptors(new SentryInterceptor());
  app.useGlobalFilters(
    new PrismaClientExceptionFilter(app.get(HttpAdapterHost).httpAdapter),
  );
  app.useGlobalPipes(new ZodValidationPipe());
  await app.init();

  const prisma = app.get(PrismaService);
  await resetDatabase(prisma);

  const user = {
    login: process.env.TEST_USER_LOGIN as string,
    password: process.env.TEST_USER_PASSWORD as string,
  };
  await prisma.user.create({
    data: {
      login: user.login,
      name: process.env.TEST_USER_NAME as string,
      password: await argon2.hash(user.password, { type: argon2.argon2id }),
    },
  });

  return {
    app,
    prisma,
    redis,
    notificationQueue,
    whatsapp,
    user,
    close: async () => {
      await redis.flushdb();
      await app.close();
      await prisma.$disconnect();
    },
  };
}

/** Очистка всех таблиц (кроме служебной `_prisma_migrations`) между тестами/наборами. */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`,
  );
}

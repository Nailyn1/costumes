process.env.TZ = 'UTC';
import './instrument';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

import cookieParser from 'cookie-parser';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe';
import { PrismaClientExceptionFilter } from './common/filters/prisma-client-exception.filter';
import { Logger } from 'nestjs-pino';
import { SentryInterceptor } from './common/interceptors/sentry.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useLogger(app.get(Logger));
  const { httpAdapter } = app.get(HttpAdapterHost);

  app.use(cookieParser());
  app.enableCors({
    origin: [
      process.env.CLIENT_URL,
      'http://localhost',
      'http://127.0.0.1',
      'http://localhost:80',
    ],
    credentials: true,
    exposedHeaders: 'set-cookie',
  });
  app.useGlobalInterceptors(new SentryInterceptor());
  app.useGlobalFilters(new PrismaClientExceptionFilter(httpAdapter));
  app.useGlobalPipes(new ZodValidationPipe());
  await app.listen(process.env.PORT ?? 5000);
}
bootstrap();

process.env.TZ = 'UTC';
import './instrument';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

import cookieParser from 'cookie-parser';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { Logger } from 'nestjs-pino';
import { getAllowedOrigins } from './config/cors.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useLogger(app.get(Logger));
  const { httpAdapter } = app.get(HttpAdapterHost);

  app.use(cookieParser());
  app.enableCors({
    origin: getAllowedOrigins(),
    credentials: true,
    exposedHeaders: 'set-cookie',
  });
  app.useGlobalFilters(new ApiExceptionFilter(httpAdapter));
  app.useGlobalPipes(new ZodValidationPipe());
  await app.listen(process.env.PORT ?? 5000);
}
void bootstrap();

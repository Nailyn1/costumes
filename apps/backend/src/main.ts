import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

import cookieParser from 'cookie-parser';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());
  app.enableCors({
    origin: process.env.CLIENT_URL,
    credentials: true,
    exposedHeaders: 'set-cookie',
  });

  app.useGlobalPipes(new ZodValidationPipe());

  await app.listen(process.env.PORT ?? 5000);
}
bootstrap();

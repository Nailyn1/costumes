import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { ClientChildModule } from './client-child/client-child.module';
import { CostumesModule } from './costumes/costumes.module';
import { VisitOrderModule } from './visit-order/visit-order.module';
import { QueueModule } from './redis/queue.module';
import { NotificationModule } from './notification/notification.module';
import { IdempotencyInterceptor } from './redis/redis.idempotency';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { loggerConfigFactory } from './config/logger.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', 'apps/backend/.env'],
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: loggerConfigFactory,
    }),
    RedisModule,
    PrismaModule,
    QueueModule,
    AuthModule,
    ClientChildModule,
    CostumesModule,
    VisitOrderModule,
    NotificationModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
  ],
})
export class AppModule {}

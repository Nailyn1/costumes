import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { ClientChildModule } from './client-child/client-child.module';
import { CostumesModule } from './costumes/costumes.module';
import { VisitOrderModule } from './visit-order/visit-order.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', 'apps/backend/.env'],
    }),
    RedisModule,
    PrismaModule,
    AuthModule,
    ClientChildModule,
    CostumesModule,
    VisitOrderModule,
  ],
})
export class AppModule {}

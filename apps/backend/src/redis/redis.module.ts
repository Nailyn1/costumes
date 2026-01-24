import { Global, Module, OnApplicationShutdown } from '@nestjs/common';
import { redisProvider } from './redis.provider';
import { REDIS_CLIENT } from './redis.constants';
import Redis from 'ioredis';
import { ModuleRef } from '@nestjs/core';

@Global()
@Module({
  providers: [redisProvider],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(private readonly moduleRef: ModuleRef) {}

  // Метод автоматически закроет соединение с Redis при выключении сервера
  async onApplicationShutdown() {
    const client = this.moduleRef.get<Redis>(REDIS_CLIENT);
    if (client) {
      await client.quit();
      console.log('📡 Redis connection closed safely');
    }
  }
}

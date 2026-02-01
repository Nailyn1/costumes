import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VisitOrderService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly prisma: PrismaService,
  ) {}

  async generatePreviewCode(): Promise<string> {
    const MAX_ATTEMPTS = 10;

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const code = Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, '0');

      const redisKey = `visit_code_lock:${code}`;
      const isLocked = await this.redis.get(redisKey);

      if (isLocked) continue;

      const isUsed = await this.prisma.visit.findUnique({
        where: { visitCode: code },
        select: { id: true },
      });

      if (isUsed) continue;
      const success = await this.redis.set(
        redisKey,
        'reserved',
        'EX',
        15 * 60,
        'NX',
      );

      if (success) return code;
    }

    throw new InternalServerErrorException(
      'Не удалось сгенерировать уникальный код. Попробуйте позже.',
    );
  }
}

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Observable, of, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import Redis from 'ioredis';
import * as crypto from 'crypto';
import { Request, Response } from 'express'; // Импортируем типы Express
import { REDIS_CLIENT } from './redis.constants';

// 1. Описываем структуру записи в Redis
interface IdempotencyRecord {
  status: 'processing' | 'completed';
  body: unknown;
  statusCode: number | null;
  requestHash: string;
  createdAt: string;
}

// 2. Расширяем тип Request, чтобы TS знал о поле user
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    [key: string]: unknown;
  };
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private readonly TTL = 60 * 60 * 24; // 24 часа

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const http = context.switchToHttp();
    // Указываем дженерик для getRequest, чтобы избежать 'any'
    const request = http.getRequest<AuthenticatedRequest>();

    if (!['POST', 'PATCH', 'PUT'].includes(request.method)) {
      return next.handle();
    }

    const idempotencyKey = request.headers['x-idempotency-key'];

    // Проверяем, что ключ — это строка и он не пустой
    if (typeof idempotencyKey !== 'string' || !idempotencyKey) {
      return next.handle();
    }

    const userId = request.user?.id || 'anon';
    const pathHash = crypto.createHash('md5').update(request.url).digest('hex');
    const redisKey = `idempotency:${userId}:${pathHash}:${idempotencyKey}`;

    // Безопасное хеширование тела запроса
    const bodyString = request.body ? JSON.stringify(request.body) : '{}';
    const currentRequestHash = crypto
      .createHash('sha256')
      .update(bodyString)
      .digest('hex');

    const cachedData = await this.redis.get(redisKey);

    if (cachedData) {
      // Приводим результат парсинга к нашему интерфейсу
      const record = JSON.parse(cachedData) as IdempotencyRecord;

      if (record.status === 'processing') {
        throw new ConflictException(
          'Request with this key is already being processed',
        );
      }

      if (record.requestHash !== currentRequestHash) {
        throw new BadRequestException(
          'Idempotency Key used with different request body',
        );
      }

      const response = http.getResponse<Response>();

      if (record.statusCode) {
        response.status(record.statusCode);
      }

      response.setHeader('X-Idempotency-Cache', 'HIT');
      return of(record.body);
    }

    const initialRecord: IdempotencyRecord = {
      status: 'processing',
      body: null,
      statusCode: null,
      requestHash: currentRequestHash,
      createdAt: new Date().toISOString(),
    };

    const setOk = await this.redis.set(
      redisKey,
      JSON.stringify(initialRecord),
      'EX',
      this.TTL,
      'NX',
    );

    if (!setOk) {
      throw new ConflictException('Request already in progress');
    }

    return next.handle().pipe(
      tap((responseBody: unknown) => {
        const httpResponse = http.getResponse<Response>();

        const completedRecord: IdempotencyRecord = {
          ...initialRecord,
          status: 'completed',
          body: responseBody,
          statusCode: httpResponse.statusCode,
        };

        void this.redis.set(
          redisKey,
          JSON.stringify(completedRecord),
          'EX',
          this.TTL,
        );
      }),
      catchError((err: unknown) => {
        // Удаляем ключ, если основной поток завершился ошибкой
        void this.redis.del(redisKey);
        return throwError(() => err);
      }),
    );
  }
}

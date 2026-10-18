import { createHash, timingSafeEqual } from 'crypto';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

// Сравнение хэшей одинаковой длины: постоянное время и без утечки длины токена.
const sha256 = (value: string) => createHash('sha256').update(value).digest();

/**
 * Проверяет `Authorization: Bearer <token>` вебхука Green-API
 * (настройка инстанса `webhookUrlToken`) против `GREEN_API_WEBHOOK_TOKEN`.
 * Токен не задан: в production запрос отклоняется, иначе — пропускается с warning.
 */
@Injectable()
export class WebhookTokenGuard implements CanActivate {
  private readonly logger = new Logger(WebhookTokenGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.configService.get<string>('GREEN_API_WEBHOOK_TOKEN');

    if (!expected) {
      if (this.configService.get<string>('NODE_ENV') === 'production') {
        this.logger.error(
          'GREEN_API_WEBHOOK_TOKEN is not set: webhook rejected in production',
        );
        throw new UnauthorizedException('Не авторизован');
      }
      this.logger.warn(
        'GREEN_API_WEBHOOK_TOKEN is not set: webhook is accepted without authorization (non-production only)',
      );
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    const match =
      typeof header === 'string' ? /^Bearer (.+)$/.exec(header) : null;

    if (!match || !timingSafeEqual(sha256(match[1]), sha256(expected))) {
      this.logger.warn('Webhook rejected: missing or invalid Authorization');
      throw new UnauthorizedException('Не авторизован');
    }

    return true;
  }
}

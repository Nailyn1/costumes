import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { AbstractHttpAdapter } from '@nestjs/core';
import * as Sentry from '@sentry/nestjs';
import type { Common_Error } from '@costumes/shared';
import type { Response } from 'express';
import { Prisma } from '../../prisma/generated/client';

const defaultMessages: Record<number, string> = {
  400: 'Проверьте введённые данные',
  401: 'Необходима авторизация',
  403: 'Доступ запрещён',
  404: 'Запись не найдена',
  405: 'Операция недоступна',
  409: 'Конфликт данных. Обновите страницу и повторите попытку',
  429: 'Слишком много запросов. Повторите попытку позже',
};

type ErrorDetails = {
  message: string;
  code?: string;
  fieldErrors?: Record<string, string[]>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeMessage(value: unknown, status: number): string {
  // Сообщения библиотек и стандартных Nest pipes бывают английскими и техническими.
  if (
    typeof value === 'string' &&
    /[А-Яа-яЁё]/u.test(value) &&
    !/[{}[\]<>]|\b(?:stack|regex|invalid_type|undefined)\b/iu.test(value)
  ) {
    return value;
  }
  return defaultMessages[status] ?? 'Не удалось выполнить запрос';
}

function safeFieldErrors(value: unknown): Record<string, string[]> | undefined {
  if (!isRecord(value)) return undefined;
  const entries = Object.entries(value).filter(
    ([key, messages]) =>
      /^[a-zA-Z0-9_.-]+$/.test(key) &&
      Array.isArray(messages) &&
      messages.every(
        (message) => typeof message === 'string' && /[А-Яа-яЁё]/u.test(message),
      ),
  ) as [string, string[]][];
  return entries.length ? Object.fromEntries(entries) : undefined;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  constructor(private readonly httpAdapter: AbstractHttpAdapter) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    if (response.headersSent) return;

    const { status, details } = this.normalize(exception);
    const body: Common_Error = {
      statusCode: status,
      message: details.message,
      ...(details.code ? { code: details.code } : {}),
      ...(details.fieldErrors ? { fieldErrors: details.fieldErrors } : {}),
    };
    this.httpAdapter.reply(response, body, status);
  }

  private normalize(exception: unknown): {
    status: number;
    details: ErrorDetails;
  } {
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        const fields = this.uniqueFields(exception.meta);
        return {
          status: HttpStatus.CONFLICT,
          details: {
            message: 'Такая запись уже существует в системе',
            code: 'P2002',
            ...(fields.length
              ? {
                  fieldErrors: Object.fromEntries(
                    fields.map((field) => [
                      field,
                      ['Это значение уже используется'],
                    ]),
                  ),
                }
              : {}),
          },
        };
      }
      if (exception.code === 'P2025') {
        return {
          status: HttpStatus.NOT_FOUND,
          details: { message: 'Запись не найдена', code: 'P2025' },
        };
      }
      if (exception.code === 'P2003') {
        return {
          status: HttpStatus.CONFLICT,
          details: {
            message: 'Запись связана с другими данными',
            code: 'P2003',
          },
        };
      }
      if (exception.code === 'P2034') {
        return {
          status: HttpStatus.CONFLICT,
          details: {
            message: 'Данные изменились. Обновите страницу и повторите попытку',
            code: 'P2034',
          },
        };
      }
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status >= 500) {
        this.reportUnexpected(exception);
        return {
          status,
          details: { message: 'Внутренняя ошибка сервера' },
        };
      }
      const response = exception.getResponse();
      const data = isRecord(response) ? response : { message: response };
      const message = safeMessage(data.message, status);
      const fieldErrors = safeFieldErrors(data.fieldErrors);
      const code =
        typeof data.code === 'string' && /^[A-Z0-9_]+$/.test(data.code)
          ? data.code
          : undefined;
      return { status, details: { message, code, fieldErrors } };
    }

    // Не пишем message или тело запроса в лог: там могут быть персональные данные.
    this.reportUnexpected(exception);
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      details: { message: 'Внутренняя ошибка сервера' },
    };
  }

  private reportUnexpected(exception: unknown): void {
    const name = exception instanceof Error ? exception.name : typeof exception;
    this.logger.error(`Необработанная HTTP-ошибка (${name})`);
    Sentry.captureException(exception);
  }

  private uniqueFields(meta: unknown): string[] {
    if (!isRecord(meta)) return [];
    const target = meta.target;
    const adapter = isRecord(meta.driverAdapterError)
      ? meta.driverAdapterError
      : null;
    const cause = adapter && isRecord(adapter.cause) ? adapter.cause : null;
    const constraint =
      cause && isRecord(cause.constraint) ? cause.constraint : null;
    const fields = Array.isArray(target) ? target : constraint?.fields;
    const allowed = new Set(['phone', 'name', 'email']);
    return Array.isArray(fields)
      ? fields.filter(
          (field): field is string =>
            typeof field === 'string' && allowed.has(field),
        )
      : [];
  }
}

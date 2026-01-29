import { ArgumentsHost, Catch, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '../../prisma/generated/client';
import { Response } from 'express';

interface PrismaErrorMeta {
  target?: string[];
  driverAdapterError?: {
    cause?: {
      constraint?: {
        fields?: string[];
      };
    };
  };
}

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaClientExceptionFilter extends BaseExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // Словарь для перевода полей на человеческий язык
    const fieldLabels: Record<string, string> = {
      phone: 'номер телефона',
      name: 'имя',
      email: 'email',
    };

    switch (exception.code) {
      case 'P2002': {
        const status = HttpStatus.CONFLICT;
        const meta = exception.meta as PrismaErrorMeta | undefined;

        // Извлекаем поля из разных возможных структур Prisma
        const fields: string[] =
          meta?.target || // Стандартный путь
          meta?.driverAdapterError?.cause?.constraint?.fields || // Твой текущий путь (Driver Adapter)
          [];

        const readableFields = fields
          .map((f) => fieldLabels[f] || f)
          .join(', ');

        const message = readableFields
          ? `Запись с таким значением уже существует: ${readableFields}`
          : 'Такая запись уже существует в системе.';

        response.status(status).json({
          statusCode: status,
          message,
          error: 'Conflict',
          fields, // Возвращаем массив для фронтенда (чтобы подсветить инпут)
        });
        break;
      }

      case 'P2025': {
        const status = HttpStatus.NOT_FOUND;
        response.status(status).json({
          statusCode: status,
          message: 'Запись не найдена', // Упрощаем сообщение для клиента
          error: 'Not Found',
        });
        break;
      }

      default:
        // Все остальные ошибки Prisma (P2003 и т.д.) прокидываем в стандартный обработчик
        super.catch(exception, host);
        break;
    }
  }
}

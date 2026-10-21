import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AbstractHttpAdapter } from '@nestjs/core';
import * as Sentry from '@sentry/nestjs';
import { Prisma } from '../../prisma/generated/client';
import { ApiExceptionFilter } from './api-exception.filter';

jest.mock('@sentry/nestjs', () => ({ captureException: jest.fn() }));

describe('ApiExceptionFilter', () => {
  const reply = jest.fn();
  const adapter = { reply } as unknown as AbstractHttpAdapter;
  const response = { headersSent: false };
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as ArgumentsHost;
  const filter = new ApiExceptionFilter(adapter);

  beforeEach(() => {
    reply.mockClear();
    jest.mocked(Sentry.captureException).mockClear();
  });

  it('normalizes Nest validation and keeps safe field errors', () => {
    filter.catch(
      new BadRequestException({
        message: 'Validation failed',
        fieldErrors: { name: ['Укажите имя'] },
        code: 'VALIDATION_ERROR',
      }),
      host,
    );
    expect(reply).toHaveBeenCalledWith(
      response,
      {
        statusCode: 400,
        message: 'Проверьте введённые данные',
        code: 'VALIDATION_ERROR',
        fieldErrors: { name: ['Укажите имя'] },
      },
      400,
    );
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('does not expose ParseIntPipe English text or input value', () => {
    filter.catch(
      new BadRequestException('Validation failed (numeric string is expected)'),
      host,
    );
    expect(reply).toHaveBeenCalledWith(
      response,
      {
        statusCode: 400,
        message: 'Проверьте введённые данные',
      },
      400,
    );
  });

  it('keeps Russian domain conflict messages', () => {
    filter.catch(
      new ConflictException('Костюм уже занят на выбранные даты'),
      host,
    );
    expect(reply).toHaveBeenCalledWith(
      response,
      {
        statusCode: 409,
        message: 'Костюм уже занят на выбранные даты',
      },
      409,
    );
  });

  it('returns a safe 401 without changing the status', () => {
    filter.catch(new UnauthorizedException('Unauthorized'), host);
    expect(reply).toHaveBeenCalledWith(
      response,
      {
        statusCode: 401,
        message: 'Необходима авторизация',
      },
      401,
    );
  });

  it('returns a safe 404 without changing the status', () => {
    filter.catch(new NotFoundException('Cannot GET /secret-path'), host);
    expect(reply).toHaveBeenCalledWith(
      response,
      {
        statusCode: 404,
        message: 'Запись не найдена',
      },
      404,
    );
  });

  it('maps known Prisma errors without exposing meta', () => {
    const error = new Prisma.PrismaClientKnownRequestError('secret phone', {
      code: 'P2002',
      clientVersion: '7.0.0',
      meta: { target: ['phone'] },
    });
    Object.defineProperty(error, 'code', { value: 'P2002' });
    Object.defineProperty(error, 'meta', { value: { target: ['phone'] } });
    filter.catch(error, host);
    expect(reply).toHaveBeenCalledWith(
      response,
      {
        statusCode: HttpStatus.CONFLICT,
        message: 'Такая запись уже существует в системе',
        code: 'P2002',
        fieldErrors: { phone: ['Это значение уже используется'] },
      },
      HttpStatus.CONFLICT,
    );
  });

  it('hides unexpected error details', () => {
    const secret = 'secret internal payload';
    const privateHost = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => ({
          url: `/clients/search?phone=${secret}`,
          headers: { authorization: `Bearer ${secret}` },
          body: { password: secret },
        }),
      }),
    } as ArgumentsHost;
    filter.catch(new Error('internal failure'), privateHost);
    expect(reply).toHaveBeenCalledWith(
      response,
      {
        statusCode: 500,
        message: 'Внутренняя ошибка сервера',
      },
      500,
    );
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(
      JSON.stringify(jest.mocked(Sentry.captureException).mock.calls),
    ).not.toContain(secret);
  });
});

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable()
export class SentryInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error: unknown) => {
        const httpContext = context.switchToHttp();
        const request = httpContext.getRequest<
          Request & { traceId?: string }
        >();
        Sentry.withScope((scope) => {
          const traceId = request['traceId'];
          if (traceId) {
            scope.setTag('traceId', traceId);
            scope.setUser({ id: traceId });
          }

          scope.setContext('request_info', {
            url: request.url,
            method: request.method,
            body: request.body,
          });

          Sentry.captureException(error);
        });

        return throwError(() => error);
      }),
    );
  }
}

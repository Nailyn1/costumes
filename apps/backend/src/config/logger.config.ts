import { Params } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { IncomingMessage } from 'http';
import { join } from 'path';

interface RequestWithUser extends IncomingMessage {
  user?: {
    login: string;
  };
}

export const loggerConfigFactory = (configService: ConfigService): Params => {
  const isProduction = configService.get('NODE_ENV') === 'production';
  const logPath = join(process.cwd(), 'logs');
  return {
    pinoHttp: {
      customSuccessMessage: (req, res, responseTime) => {
        const login = (req as RequestWithUser).user?.login || 'Guest';
        return `${login} | ${req.method} ${req.url} | ${res.statusCode} | ${responseTime}ms`;
      },
      customErrorMessage: (req, res, err) => {
        const login = (req as RequestWithUser).user?.login || 'Guest';
        return `${login} | ${req.method} ${req.url} | ERROR: ${err.message}`;
      },
      customLogLevel: (req, res, err) => {
        if (err) return 'error';
        const url = req.url || '';

        if (
          req.url?.includes('/webhooks/whatsapp') &&
          res.statusCode >= 200 &&
          res.statusCode < 300
        ) {
          return 'silent';
        }
        if (
          res.statusCode < 400 &&
          (url.includes('/visits/not_written') ||
            url.includes('/visits/notification'))
        ) {
          return 'silent';
        }

        return isProduction ? 'info' : 'debug';
      },
      redact: {
        paths: ['req.headers.authorization', 'phone'],
        censor: '***',
      },
      customProps: (req) => {
        const userRequest = req as RequestWithUser;
        return {
          context: 'HTTP',
          login: userRequest.user?.login,
        };
      },
      transport: {
        targets: [
          {
            target: isProduction ? 'pino/file' : 'pino-pretty',
            level: isProduction ? 'info' : 'debug',
            options: isProduction
              ? { destination: 1 }
              : {
                  colorize: true,
                  singleLine: false,
                  levelFirst: true,
                  translateTime: 'HH:MM:ss',
                  ignore: 'req,res,context,login,responseTime,event',
                  messageFormat: '{context} | {msg}',
                },
          },
          {
            target: 'pino-roll',
            level: 'info',
            options: {
              file: join(logPath, 'app'),
              frequency: 'daily',
              limit: { count: 7 },
              mkdir: true,
              extension: '.log',
            },
          },
        ],
      },
      level: isProduction ? 'info' : 'debug',
      genReqId: (req) => req.headers['x-request-id'] || crypto.randomUUID(),

      quietReqLogger: isProduction,
    },
  };
};

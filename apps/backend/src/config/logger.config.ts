import { Params } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { IncomingMessage } from 'http';

interface RequestWithUser extends IncomingMessage {
  user?: {
    login: string;
  };
}

export const loggerConfigFactory = (configService: ConfigService): Params => {
  const isProduction = configService.get('NODE_ENV') === 'production';

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
      redact: {
        paths: ['req.headers.authorization'],
        censor: '***',
      },
      customProps: (req) => {
        const userRequest = req as RequestWithUser;
        return {
          context: 'HTTP',
          login: userRequest.user?.login,
        };
      },
      transport: !isProduction
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              singleLine: false,
              levelFirst: true,
              translateTime: 'HH:MM:ss',
              ignore: 'req,res,context,login,responseTime',
              messageFormat: '{msg}',
            },
          }
        : undefined,
      level: isProduction ? 'info' : 'debug',
      genReqId: (req) => req.headers['x-request-id'] || crypto.randomUUID(),

      quietReqLogger: isProduction,
    },
  };
};

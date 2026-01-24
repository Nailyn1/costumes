// auth/strategies/jwt-refresh.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(private readonly configService: ConfigService) {
    const rfSecret = configService.get<string>('JWT_SECRET');

    if (!rfSecret) {
      throw new Error('JWT_SECRET is not defined');
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          return request?.cookies?.refreshToken as string;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: rfSecret,
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: { id: string; login: string }) {
    const refreshToken = req.cookies?.refreshToken as string;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found in cookies');
    }

    return { id: payload.id, login: payload.login, refreshToken };
  }
}

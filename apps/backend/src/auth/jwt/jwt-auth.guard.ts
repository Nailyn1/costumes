import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {
  handleRequest<TUser = unknown>(err: unknown, user: TUser | false): TUser {
    if (err || !user) {
      throw new UnauthorizedException('Недействительный токен обновления');
    }
    return user;
  }
}

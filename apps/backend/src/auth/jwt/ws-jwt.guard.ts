import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { ActiveUserData, SocketWithAuth } from '../active-user.interface';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const jwtSecret = this.configService.get<string>('JWT_SECRET');

    const client: Socket = context.switchToWs().getClient<Socket>();
    const token = this.extractTokenFromClient(client);

    if (!token) {
      throw new WsException('Unauthorized: No token provided');
    }

    try {
      const payload = await this.jwtService.verifyAsync<ActiveUserData>(token, {
        secret: jwtSecret,
      });
      (client as SocketWithAuth).user = payload;
    } catch {
      throw new WsException('Unauthorized: Invalid token');
    }

    return true;
  }

  private extractTokenFromClient(client: Socket): string | undefined {
    const authPayload = client.handshake.auth;
    if (authPayload && typeof authPayload.token === 'string') {
      return authPayload.token;
    }

    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.split(' ')[1];
    }

    return undefined;
  }
}

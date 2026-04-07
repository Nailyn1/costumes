import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { NotificationService } from './notification.service';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import * as crypto from 'crypto';
import { forwardRef, Inject, UseGuards } from '@nestjs/common';
import { WsJwtGuard } from '../auth/jwt/ws-jwt.guard';
import { ActiveUserData, SocketWithAuth } from '../auth/active-user.interface';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

interface StatusUpdate {
  notificationId: number;
  status: string;
  totalToday?: number;
}

@UseGuards(WsJwtGuard)
@WebSocketGateway({ cors: true })
export class NotificationGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(
    @Inject(forwardRef(() => NotificationService))
    private readonly notificationService: NotificationService,
    @InjectPinoLogger(NotificationGateway.name)
    private readonly logger: PinoLogger,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: SocketWithAuth) {
    try {
      let token: string | undefined = undefined;

      const authPayload = client.handshake.auth;
      if (authPayload && typeof authPayload.token === 'string') {
        token = authPayload.token;
      }

      if (!token) {
        const authHeader = client.handshake.headers.authorization;
        token = authHeader?.split(' ')[1];
      }

      if (!token) {
        const l = this.logger.logger.child({
          context: 'WS_IN',
          event: 'connection',
          login: 'Guest',
        });

        l.warn(
          `Guest | EVENT connection | ERROR | No token provided. Disconnecting.`,
        );
        client.disconnect();
        return;
      }

      const jwtSecret = this.configService.get<string>('JWT_SECRET');
      const payload = await this.jwtService.verifyAsync<ActiveUserData>(token, {
        secret: jwtSecret,
      });

      client.user = payload;
      const login = payload.login;

      const l = this.logger.logger.child({
        context: 'WS_IN',
        event: 'connection',
        login,
      });

      l.info(
        `${login} | EVENT connection | SUCCESS | Client successfully connected`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      const l = this.logger.logger.child({
        context: 'WS_IN',
        event: 'connection',
        login: 'Guest',
      });

      l.warn(
        `Guest | EVENT connection | ERROR | Invalid token: ${errorMessage}. Disconnecting.`,
      );
      client.disconnect();
    }
  }

  @SubscribeMessage('resend_notification')
  async handleResendNotification(
    @MessageBody() data: { notificationId: number },
    @ConnectedSocket() client: SocketWithAuth,
  ) {
    const traceId = crypto.randomUUID();
    const login = client.user?.login || 'Guest';

    const l = this.logger.logger.child({
      traceId,
      context: 'WS_IN',
      notificationId: data.notificationId,
      clientId: client.id,
      login: login,
      event: 'resend_notification',
    });

    try {
      l.info(
        `${login} | EVENT resend_notification | START | notificationId: ${data.notificationId}`,
      );

      await this.notificationService.handleManualResend(data.notificationId, l);
      l.info(`${login} | EVENT resend_notification | SUCCESS`);
      return { status: 'success', traceId };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      l.error(`${login} | EVENT resend_notification | ERROR: ${errorMessage}`);

      return { status: 'error', message: errorMessage };
    }
  }

  @SubscribeMessage('update_phone_and_resend')
  async handleUpdatePhoneAndResend(
    @MessageBody() data: { notificationId: number; newPhone: string },
    @ConnectedSocket() client: SocketWithAuth,
  ) {
    const traceId = crypto.randomUUID();
    const login = client.user?.login || 'Guest';

    const l = this.logger.logger.child({
      traceId,
      context: 'WS_IN',
      notificationId: data.notificationId,
      newPhone: data.newPhone,
      clientId: client.id,
      login: login,
      event: 'update_phone_and_resend',
    });

    try {
      l.info(
        `${login} | EVENT update_phone_and_resend | START | notificationId: ${data.notificationId}, newPhone: ${data.newPhone}`,
      );

      await this.notificationService.handleUpdatePhoneAndResend(
        data.notificationId,
        data.newPhone,
        l,
      );

      l.info(`${login} | EVENT update_phone_and_resend | SUCCESS`);
      return { status: 'success', traceId };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      l.error(
        `${login} | EVENT update_phone_and_resend | ERROR: ${errorMessage}`,
      );
      return { status: 'error', message: errorMessage };
    }
  }

  emitNotificationStatusUpdate(payload: StatusUpdate, traceId: string) {
    this.server.emit('notification_status_updated', payload);

    const l = this.logger.logger.child({
      traceId,
      context: 'WS_OUT',
      notificationId: payload.notificationId,
      event: 'ws_status_update',
    });
    l.info(
      `System | EMIT notification_status_updated | status: ${payload.status} | totalToday: ${payload.totalToday}`,
    );
  }
}

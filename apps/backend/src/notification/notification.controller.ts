import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

export interface GreenApiStatusWebhook {
  typeWebhook: 'outgoingMessageStatus' | 'outgoingAPIMessageStatus';
  chatId: string;
  instanceData: {
    idInstance: number;
    wid: string;
    typeInstance: string;
  };
  timestamp: number;
  idMessage: string;
  status: string;
  sendByApi: boolean;
}

export interface GreenApiIncomingWebhook {
  typeWebhook: 'incomingMessageReceived';
  chatId?: string;
  instanceData: {
    idInstance: number;
    wid: string;
    typeInstance: string;
  };
  timestamp: number;
  idMessage: string;
  senderData: {
    chatId: string;
    sender: string;
    chatName?: string;
    senderName?: string;
    senderContactName?: string;
  };
  messageData: {
    typeMessage: string;
    textMessageData: {
      textMessage: string;
    };
  };
}

export interface GreenApiStateWebhook {
  typeWebhook: 'stateInstanceChanged';
  instanceData: {
    idInstance: number;
    wid: string;
    typeInstance: string;
  };
  timestamp: number;
  stateInstance: 'authorized' | 'notAuthorized' | 'starting' | 'blocked';
}

export type GreenApiWebhook =
  | GreenApiStatusWebhook
  | GreenApiIncomingWebhook
  | GreenApiStateWebhook;

@Controller('webhooks/whatsapp')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    @InjectPinoLogger(NotificationController.name)
    private readonly logger: PinoLogger,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebHook(@Body() body: GreenApiWebhook, @Req() req: any) {
    const l = await this.notificationService.getContextualLogger(body, req);

    l.debug(
      { webhookType: body.typeWebhook, payload: body },
      'Received Green-API webhook',
    );
    try {
      if (
        body.typeWebhook === 'outgoingMessageStatus' ||
        body.typeWebhook === 'outgoingAPIMessageStatus'
      ) {
        await this.notificationService.changeOutgoingStatus(
          body.idMessage,
          body.status,
          l,
        );
      } else if (body.typeWebhook === 'incomingMessageReceived') {
        const { chatId } = body.senderData;
        await this.notificationService.changeIncomingStatus(chatId, l);
      } else if (body.typeWebhook === 'stateInstanceChanged') {
        await this.notificationService.handleInstanceStateChange(
          body.instanceData.idInstance,
          body.stateInstance,
          body.timestamp,
          l,
        );
      }
    } catch (error) {
      const idMessage = 'idMessage' in body ? body.idMessage : undefined;
      l.error(
        {
          err: error,
          webhookType: body.typeWebhook,
          idMessage,
        },
        'Error processing Green-API webhook',
      );
      throw error;
    }

    return { ok: true };
  }
}

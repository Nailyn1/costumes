import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';
import { NotificationService } from './notification.service';

interface GreenApiStatusWebhook {
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

interface GreenApiIncomingWebhook {
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

interface GreenApiStateWebhook {
  typeWebhook: 'stateInstanceChanged';
  instanceData: {
    idInstance: number;
    wid: string;
    typeInstance: string;
  };
  timestamp: number;
  stateInstance: 'authorized' | 'notAuthorized' | 'starting' | 'blocked';
}

type GreenApiWebhook =
  | GreenApiStatusWebhook
  | GreenApiIncomingWebhook
  | GreenApiStateWebhook;

@Controller('webhooks/whatsapp')
export class NotificationController {
  private readonly logger = new Logger(NotificationService.name);
  constructor(private readonly notificationService: NotificationService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebHook(@Body() body: GreenApiWebhook) {
    this.logger.debug('Body from GREEN-API', body);

    if (
      body.typeWebhook === 'outgoingMessageStatus' ||
      body.typeWebhook === 'outgoingAPIMessageStatus'
    ) {
      await this.notificationService.changeOutgoingStatus(
        body.idMessage,
        body.status,
      );
    } else if (body.typeWebhook === 'incomingMessageReceived') {
      const { chatId } = body.senderData;
      await this.notificationService.changeIncomingStatus(chatId);
    } else if (body.typeWebhook === 'stateInstanceChanged') {
      await this.notificationService.handleInstanceStateChange(
        body.instanceData.idInstance,
        body.stateInstance,
        body.timestamp,
      );
    }

    return { ok: true };
  }
}

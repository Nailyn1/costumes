import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import axios from 'axios';

interface GreenApiSendMessageResponse {
  idMessage: string;
}

@Injectable()
export class WhatsappProvider {
  private readonly logger = new Logger(WhatsappProvider.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
  ) {}

  async sendMessage(phoneNumber: string, message: string): Promise<string> {
    const idInstance = this.config.get<string>('GREEN_API_ID_INSTANCE');
    const apiToken = this.config.get<string>('GREEN_API_TOKEN');

    const url = `https://api.green-api.com/waInstance${idInstance}/sendMessage/${apiToken}`;
    const cleanPhone = phoneNumber.replace(/\D/g, '');

    const payload = {
      chatId: `${cleanPhone}@c.us`,
      message: message,
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post<GreenApiSendMessageResponse>(url, payload),
      );

      return response.data.idMessage;
    } catch (error) {
      let errorMessage = 'Неизвестная ошибка при отправке WhatsApp';
      if (axios.isAxiosError(error)) {
        const serverMessage =
          error.response?.data &&
          typeof error.response.data === 'object' &&
          'message' in error.response.data
            ? String(
                (error.response.data as Record<string, unknown>)['message'],
              )
            : null;

        errorMessage = serverMessage || error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      this.logger.error(`Green-API Error: ${errorMessage}`);
      throw new Error(
        `Ошибка при отправке сообщения в WhatsApp: ${errorMessage}`,
      );
    }
  }

  async getStateInstance(): Promise<string> {
    const idInstance = this.config.get<string>('GREEN_API_ID_INSTANCE');
    const apiToken = this.config.get<string>('GREEN_API_TOKEN');
    const url = `https://api.green-api.com/waInstance${idInstance}/getStateInstance/${apiToken}`;

    try {
      const response = await firstValueFrom(
        this.httpService.get<{ stateInstance: string }>(url),
      );
      return response.data.stateInstance;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Ошибка при получении статуса инстанса: ${errorMessage}`,
      );
      return 'unknown';
    }
  }
}

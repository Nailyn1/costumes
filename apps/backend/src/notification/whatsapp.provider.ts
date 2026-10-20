import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

interface GreenApiSendMessageResponse {
  idMessage: string;
}

interface GreenApiCheckWhatsappResponse {
  existsWhatsapp: boolean;
}

@Injectable()
export class WhatsappProvider {
  private readonly logger = new Logger(WhatsappProvider.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
  ) {}

  private endpoint(method: string): string {
    const base =
      this.config.get<string>('GREEN_API_URL') || 'https://api.green-api.com';
    const instance = this.config.get<string>('GREEN_API_ID_INSTANCE');
    const token = this.config.get<string>('GREEN_API_TOKEN');
    if (!instance || !token) throw new Error('Green-API не настроен');
    return `${base.replace(/\/$/, '')}/waInstance${instance}/${method}/${token}`;
  }

  async checkWhatsapp(phoneNumber: string, force = false): Promise<boolean> {
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (!/^7\d{10}$/.test(cleanPhone))
      throw new Error('Некорректный номер телефона');
    const response = await firstValueFrom(
      this.httpService.post<GreenApiCheckWhatsappResponse>(
        this.endpoint('checkWhatsapp'),
        { chatId: `${cleanPhone}@c.us`, force },
      ),
    );
    if (typeof response.data?.existsWhatsapp !== 'boolean') {
      throw new Error('Некорректный ответ Green-API');
    }
    return response.data.existsWhatsapp;
  }

  async sendMessage(phoneNumber: string, message: string): Promise<string> {
    const url = this.endpoint('sendMessage');
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
    } catch {
      // Axios может включить токен из URL в сообщении об ошибке.
      this.logger.error('Ошибка отправки через Green-API');
      throw new Error('Ошибка при отправке сообщения в WhatsApp');
    }
  }

  async getStateInstance(): Promise<string> {
    const url = this.endpoint('getStateInstance');

    try {
      const response = await firstValueFrom(
        this.httpService.get<{ stateInstance: string }>(url),
      );
      return response.data.stateInstance;
    } catch {
      this.logger.error('Ошибка при получении статуса инстанса');
      return 'unknown';
    }
  }
}

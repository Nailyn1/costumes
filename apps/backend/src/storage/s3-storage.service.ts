import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

export interface PutObjectParams {
  body: Buffer;
  contentType: string;
  key: string;
}

/**
 * Публичный S3-бакет (PS Cloud). Объекты неизменяемы: ключ содержит uuid,
 * поэтому Cache-Control — immutable. Без настроенного S3 приложение стартует,
 * а методы бросают 503 с понятным сообщением.
 */
@Injectable()
export class S3StorageService {
  private readonly bucket: string;
  private readonly publicBaseUrl: string;
  private readonly client: S3Client;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>('S3_BUCKET_PUBLIC', '');
    const endpoint = this.config.get<string>(
      'S3_ENDPOINT',
      'https://object.pscloud.io',
    );
    this.publicBaseUrl = this.config.get<string>(
      'S3_PUBLIC_BASE_URL',
      this.bucket ? `https://${this.bucket}.object.pscloud.io` : '',
    );

    this.client = new S3Client({
      credentials: {
        accessKeyId: this.config.get<string>('S3_ACCESS_KEY', ''),
        secretAccessKey: this.config.get<string>('S3_SECRET_KEY', ''),
      },
      endpoint,
      forcePathStyle:
        this.config
          .get<string>('S3_FORCE_PATH_STYLE', 'false')
          .toLowerCase() === 'true',
      region: this.config.get<string>('S3_REGION', 'us-east-1'),
      // PS Cloud не принимает дополнительные checksum-заголовки SDK.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      useArnRegion: false,
    });
  }

  isConfigured(): boolean {
    return (
      Boolean(this.config.get<string>('S3_ACCESS_KEY')) &&
      Boolean(this.config.get<string>('S3_SECRET_KEY')) &&
      Boolean(this.bucket) &&
      Boolean(this.publicBaseUrl)
    );
  }

  /** Бросает 503, если S3 не настроен. */
  assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Хранилище фото не настроено: задайте S3_* в окружении сервера',
      );
    }
  }

  async putObject({ body, contentType, key }: PutObjectParams): Promise<void> {
    this.assertConfigured();
    await this.client.send(
      new PutObjectCommand({
        Body: body,
        Bucket: this.bucket,
        CacheControl: 'public, max-age=31536000, immutable',
        ContentType: contentType,
        Key: key,
      }),
    );
  }

  async deleteObject(key: string): Promise<void> {
    this.assertConfigured();
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  getPublicUrl(key: string): string {
    return `${this.publicBaseUrl.replace(/\/$/, '')}/${key.replace(/^\/+/, '')}`;
  }
}

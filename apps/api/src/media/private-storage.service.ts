import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NauStorage, createStorage } from 'nau-storage';

/**
 * Storage for personal content — voice notes, user captures.
 *
 * Deliberately a different bucket from StorageService, not a different prefix.
 * That one points at nau-storage, which has media.9nau.com bound to it and is
 * therefore public in its entirety: 106 personal voice notes were downloadable
 * by anyone who knew the path before this split existed. A prefix cannot make
 * an object in a public bucket private; only a bucket with no domain can.
 *
 * Nothing here is ever served by URL. Access is a presigned link that expires.
 */
@Injectable()
export class PrivateStorageService {
  private readonly logger = new Logger(PrivateStorageService.name);
  private storage: NauStorage | null = null;

  constructor(private configService: ConfigService) {
    const endpoint = this.configService.get<string>('R2_ENDPOINT', '');
    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID', '');
    const secretAccessKey = this.configService.get<string>('R2_SECRET_ACCESS_KEY', '');
    const bucket = this.configService.get<string>('R2_PRIVATE_BUCKET_NAME', '');

    if (endpoint && accessKeyId && secretAccessKey && bucket) {
      this.storage = createStorage({
        endpoint,
        accessKeyId,
        secretAccessKey,
        bucket,
        publicUrl: '',
        envPrefix: '',
      });
    } else {
      this.logger.warn('R2_PRIVATE_BUCKET_NAME not set — private captures unavailable');
    }
  }

  private client(): NauStorage {
    if (!this.storage) {
      throw new ServiceUnavailableException('Private storage is not configured on this server');
    }
    return this.storage;
  }

  get isConfigured(): boolean {
    return this.storage !== null;
  }

  /** Presigned PUT so the client uploads straight to R2, never through here. */
  async getUploadUrl(key: string, mimeType: string) {
    return this.client().presignUpload(key, mimeType, 900);
  }

  /** Time-limited GET. The bucket stays closed; the link expires. */
  async getPlaybackUrl(key: string, expiresIn = 900): Promise<string> {
    return this.client().presignDownload(key, expiresIn);
  }

  async download(key: string): Promise<Buffer> {
    return this.client().download(key);
  }
}

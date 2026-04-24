import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type {
  StorageConfig,
  UploadSource,
  UploadOptions,
  PresignedUpload,
  StorageObject,
  ListResult,
  ListOptions,
} from './types';

export class NauStorage {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(config: StorageConfig) {
    this.bucket = config.bucket;
    this.publicUrl = config.publicUrl;

    this.s3 = new S3Client({
      region: 'auto',
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Write
  // ---------------------------------------------------------------------------

  /**
   * Server-side upload. Use for internal jobs (workers, renderers, scrapers)
   * where the server is the data source. For browser/mobile uploads, use
   * presignUpload() so the client bears the bandwidth.
   */
  async upload(key: string, body: UploadSource, options: UploadOptions): Promise<string> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: options.mimeType,
        ...(options.size !== undefined && { ContentLength: options.size }),
        ...(options.cacheControl && { CacheControl: options.cacheControl }),
      }),
    );

    return this.cdnUrl(key);
  }

  /**
   * Issues a pre-signed PUT URL. The caller uploads directly to R2 without
   * routing bytes through the server. Valid for `expiresIn` seconds (default 15 min).
   */
  async presignUpload(
    key: string,
    mimeType: string,
    expiresIn = 900,
  ): Promise<PresignedUpload> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn });

    return { uploadUrl, storageKey: key, cdnUrl: this.cdnUrl(key) };
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  async delete(key: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  /**
   * Deletes up to 1000 objects in a single API call.
   * Split larger batches before calling.
   */
  async deleteMany(keys: string[]): Promise<void> {
    if (keys.length === 0) return;

    await this.s3.send(
      new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
      }),
    );
  }

  // ---------------------------------------------------------------------------
  // List
  // ---------------------------------------------------------------------------

  /**
   * Lists objects under a prefix. Use `delimiter: '/'` to get a folder-like
   * view (objects + common prefixes). Omit for a flat recursive listing.
   */
  async list(prefix: string, options: ListOptions = {}): Promise<ListResult> {
    const response = await this.s3.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        Delimiter: options.delimiter,
        MaxKeys: options.maxKeys,
        ContinuationToken: options.continuationToken,
      }),
    );

    const objects: StorageObject[] = (response.Contents ?? []).map((obj) => ({
      key: obj.Key!,
      size: obj.Size ?? 0,
      lastModified: obj.LastModified ?? new Date(),
      etag: obj.ETag,
    }));

    const prefixes = (response.CommonPrefixes ?? [])
      .map((p) => p.Prefix!)
      .filter(Boolean);

    return {
      objects,
      prefixes,
      isTruncated: response.IsTruncated ?? false,
      nextContinuationToken: response.NextContinuationToken,
    };
  }

  /**
   * Recursively lists all objects under a prefix, following pagination.
   * Avoid on large prefixes in hot paths — use list() with pagination instead.
   */
  async listAll(prefix: string): Promise<StorageObject[]> {
    const all: StorageObject[] = [];
    let token: string | undefined;

    do {
      const result = await this.list(prefix, { maxKeys: 1000, continuationToken: token });
      all.push(...result.objects);
      token = result.isTruncated ? result.nextContinuationToken : undefined;
    } while (token);

    return all;
  }

  // ---------------------------------------------------------------------------
  // URL
  // ---------------------------------------------------------------------------

  /** Returns the public CDN URL for a stored key. No credentials required. */
  cdnUrl(key: string): string {
    return `${this.publicUrl}/${key}`;
  }
}

/** Convenience factory so callers don't need `new`. */
export function createStorage(config: StorageConfig): NauStorage {
  return new NauStorage(config);
}

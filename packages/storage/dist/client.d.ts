import type { StorageConfig, UploadSource, UploadOptions, PresignedUpload, StorageObject, ListResult, ListOptions } from './types';
export declare class NauStorage {
    private readonly s3;
    private readonly bucket;
    private readonly publicUrl;
    constructor(config: StorageConfig);
    /**
     * Server-side upload. Use for internal jobs (workers, renderers, scrapers)
     * where the server is the data source. For browser/mobile uploads, use
     * presignUpload() so the client bears the bandwidth.
     */
    upload(key: string, body: UploadSource, options: UploadOptions): Promise<string>;
    /**
     * Issues a pre-signed PUT URL. The caller uploads directly to R2 without
     * routing bytes through the server. Valid for `expiresIn` seconds (default 15 min).
     */
    presignUpload(key: string, mimeType: string, expiresIn?: number): Promise<PresignedUpload>;
    delete(key: string): Promise<void>;
    /**
     * Deletes up to 1000 objects in a single API call.
     * Split larger batches before calling.
     */
    deleteMany(keys: string[]): Promise<void>;
    /**
     * Lists objects under a prefix. Use `delimiter: '/'` to get a folder-like
     * view (objects + common prefixes). Omit for a flat recursive listing.
     */
    list(prefix: string, options?: ListOptions): Promise<ListResult>;
    /**
     * Recursively lists all objects under a prefix, following pagination.
     * Avoid on large prefixes in hot paths — use list() with pagination instead.
     */
    listAll(prefix: string): Promise<StorageObject[]>;
    /** Returns the public CDN URL for a stored key. No credentials required. */
    cdnUrl(key: string): string;
}
/** Convenience factory so callers don't need `new`. */
export declare function createStorage(config: StorageConfig): NauStorage;
//# sourceMappingURL=client.d.ts.map
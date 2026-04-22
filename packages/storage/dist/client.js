"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NauStorage = void 0;
exports.createStorage = createStorage;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
class NauStorage {
    constructor(config) {
        this.bucket = config.bucket;
        this.publicUrl = config.publicUrl;
        this.s3 = new client_s3_1.S3Client({
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
    async upload(key, body, options) {
        await this.s3.send(new client_s3_1.PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: body,
            ContentType: options.mimeType,
            ...(options.size !== undefined && { ContentLength: options.size }),
            ...(options.cacheControl && { CacheControl: options.cacheControl }),
        }));
        return this.cdnUrl(key);
    }
    /**
     * Issues a pre-signed PUT URL. The caller uploads directly to R2 without
     * routing bytes through the server. Valid for `expiresIn` seconds (default 15 min).
     */
    async presignUpload(key, mimeType, expiresIn = 900) {
        const command = new client_s3_1.PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            ContentType: mimeType,
        });
        const uploadUrl = await (0, s3_request_presigner_1.getSignedUrl)(this.s3, command, { expiresIn });
        return { uploadUrl, storageKey: key, cdnUrl: this.cdnUrl(key) };
    }
    // ---------------------------------------------------------------------------
    // Delete
    // ---------------------------------------------------------------------------
    async delete(key) {
        await this.s3.send(new client_s3_1.DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    }
    /**
     * Deletes up to 1000 objects in a single API call.
     * Split larger batches before calling.
     */
    async deleteMany(keys) {
        if (keys.length === 0)
            return;
        await this.s3.send(new client_s3_1.DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
        }));
    }
    // ---------------------------------------------------------------------------
    // List
    // ---------------------------------------------------------------------------
    /**
     * Lists objects under a prefix. Use `delimiter: '/'` to get a folder-like
     * view (objects + common prefixes). Omit for a flat recursive listing.
     */
    async list(prefix, options = {}) {
        const response = await this.s3.send(new client_s3_1.ListObjectsV2Command({
            Bucket: this.bucket,
            Prefix: prefix,
            Delimiter: options.delimiter,
            MaxKeys: options.maxKeys,
            ContinuationToken: options.continuationToken,
        }));
        const objects = (response.Contents ?? []).map((obj) => ({
            key: obj.Key,
            size: obj.Size ?? 0,
            lastModified: obj.LastModified ?? new Date(),
            etag: obj.ETag,
        }));
        const prefixes = (response.CommonPrefixes ?? [])
            .map((p) => p.Prefix)
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
    async listAll(prefix) {
        const all = [];
        let token;
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
    cdnUrl(key) {
        return `${this.publicUrl}/${key}`;
    }
}
exports.NauStorage = NauStorage;
/** Convenience factory so callers don't need `new`. */
function createStorage(config) {
    return new NauStorage(config);
}
//# sourceMappingURL=client.js.map
import type { Readable } from 'stream';
export type StorageApp = 'flownau' | 'nauthenticity' | '9nau';
export type StorageConfig = {
    endpoint: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    publicUrl: string;
};
export type UploadSource = Buffer | Readable | Uint8Array;
export type UploadOptions = {
    mimeType: string;
    size?: number;
    cacheControl?: string;
};
export type PresignedUpload = {
    uploadUrl: string;
    storageKey: string;
    cdnUrl: string;
};
export type StorageObject = {
    key: string;
    size: number;
    lastModified: Date;
    etag?: string;
};
export type ListResult = {
    objects: StorageObject[];
    prefixes: string[];
    isTruncated: boolean;
    nextContinuationToken?: string;
};
export type ListOptions = {
    delimiter?: string;
    maxKeys?: number;
    continuationToken?: string;
};
export type AssetType = 'videos' | 'audios' | 'images' | 'thumbnails';
//# sourceMappingURL=types.d.ts.map
import type { AssetType } from './types';
/**
 * All bucket keys must be constructed through these builders.
 * Schema: {app}/{entity-path}/{filename}.{ext}
 *
 * Top-level prefix per app isolates storage namespaces, enables
 * per-app lifecycle rules, and makes access audits unambiguous.
 */
export declare const flownau: {
    /** Creator account asset (video, audio, image). */
    accountAsset: (accountId: string, type: AssetType, assetId: string, ext: string) => string;
    /** Thumbnail co-located with a video or image asset. */
    accountThumbnail: (accountId: string, assetId: string) => string;
    /** Remotion render output video. */
    renderOutput: (accountId: string, renderId: string) => string;
    /** Cover image extracted from a render output. */
    renderCover: (accountId: string, renderId: string) => string;
    /** Still image render output. */
    renderStill: (accountId: string, renderId: string) => string;
    /** Asset belonging to a template. Use 'global' as templateId for platform-wide templates. */
    templateAsset: (templateId: string, assetId: string, ext: string) => string;
    /** Thumbnail for a template asset. */
    templateThumbnail: (templateId: string, assetId: string) => string;
    /**
     * User profile avatar.
     * Overwrites in place — no timestamp suffix — so old versions never accumulate.
     */
    profileAvatar: (userId: string, ext: string) => string;
};
export declare const nauthenticity: {
    /**
     * Raw Instagram download before optimization.
     * Must be deleted by the optimization worker after processing.
     * R2 lifecycle rule on nauthenticity/raw/ provides a 7-day safety net.
     */
    rawPost: (username: string, mediaId: string, ext: string) => string;
    /** Optimized post media (permanent). */
    post: (username: string, mediaId: string, ext: string) => string;
    /**
     * Profile picture. Overwrites in place — no timestamp suffix.
     */
    profilePic: (username: string, ext: string) => string;
};
export declare const nau: {
    /** User media capture (migrated from Telegram Vault or uploaded from mobile). */
    userCapture: (userId: string, blockId: string, ext: string) => string;
    /**
     * User profile avatar. Overwrites in place — no timestamp suffix.
     */
    userAvatar: (userId: string, ext: string) => string;
};
/** Extract the file extension from a MIME type. Returns '' if unknown. */
export declare function extFromMime(mimeType: string): string;
/** Derive the AssetType bucket folder from a MIME type. */
export declare function assetTypeFromMime(mimeType: string): AssetType;
//# sourceMappingURL=paths.d.ts.map
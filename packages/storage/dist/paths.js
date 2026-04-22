"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nau = exports.nauthenticity = exports.flownau = void 0;
exports.extFromMime = extFromMime;
exports.assetTypeFromMime = assetTypeFromMime;
/**
 * All bucket keys must be constructed through these builders.
 * Schema: {app}/{entity-path}/{filename}.{ext}
 *
 * Top-level prefix per app isolates storage namespaces, enables
 * per-app lifecycle rules, and makes access audits unambiguous.
 */
// ---------------------------------------------------------------------------
// flownau
// ---------------------------------------------------------------------------
exports.flownau = {
    /** Creator account asset (video, audio, image). */
    accountAsset: (accountId, type, assetId, ext) => `flownau/accounts/${accountId}/assets/${type}/${assetId}.${ext}`,
    /** Thumbnail co-located with a video or image asset. */
    accountThumbnail: (accountId, assetId) => `flownau/accounts/${accountId}/assets/thumbnails/${assetId}.jpg`,
    /** Remotion render output video. */
    renderOutput: (accountId, renderId) => `flownau/accounts/${accountId}/outputs/${renderId}.mp4`,
    /** Cover image extracted from a render output. */
    renderCover: (accountId, renderId) => `flownau/accounts/${accountId}/outputs/${renderId}_cover.jpg`,
    /** Still image render output. */
    renderStill: (accountId, renderId) => `flownau/accounts/${accountId}/outputs/${renderId}.png`,
    /** Asset belonging to a template. Use 'global' as templateId for platform-wide templates. */
    templateAsset: (templateId, assetId, ext) => `flownau/templates/${templateId}/assets/${assetId}.${ext}`,
    /** Thumbnail for a template asset. */
    templateThumbnail: (templateId, assetId) => `flownau/templates/${templateId}/assets/thumbnails/${assetId}.jpg`,
    /**
     * User profile avatar.
     * Overwrites in place — no timestamp suffix — so old versions never accumulate.
     */
    profileAvatar: (userId, ext) => `flownau/profiles/${userId}/avatar.${ext}`,
};
// ---------------------------------------------------------------------------
// nauthenticity
// ---------------------------------------------------------------------------
exports.nauthenticity = {
    /**
     * Raw Instagram download before optimization.
     * Must be deleted by the optimization worker after processing.
     * R2 lifecycle rule on nauthenticity/raw/ provides a 7-day safety net.
     */
    rawPost: (username, mediaId, ext) => `nauthenticity/raw/${username}/posts/${mediaId}.${ext}`,
    /** Optimized post media (permanent). */
    post: (username, mediaId, ext) => `nauthenticity/content/${username}/posts/${mediaId}.${ext}`,
    /**
     * Profile picture. Overwrites in place — no timestamp suffix.
     */
    profilePic: (username, ext) => `nauthenticity/content/${username}/profile.${ext}`,
};
// ---------------------------------------------------------------------------
// 9nau
// ---------------------------------------------------------------------------
exports.nau = {
    /** User media capture (migrated from Telegram Vault or uploaded from mobile). */
    userCapture: (userId, blockId, ext) => `9nau/users/${userId}/captures/${blockId}.${ext}`,
    /**
     * User profile avatar. Overwrites in place — no timestamp suffix.
     */
    userAvatar: (userId, ext) => `9nau/users/${userId}/avatar.${ext}`,
};
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/** Extract the file extension from a MIME type. Returns '' if unknown. */
function extFromMime(mimeType) {
    const map = {
        'video/mp4': 'mp4',
        'video/quicktime': 'mov',
        'video/webm': 'webm',
        'audio/mpeg': 'mp3',
        'audio/mp4': 'm4a',
        'audio/aac': 'aac',
        'audio/wav': 'wav',
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
    };
    return map[mimeType] ?? '';
}
/** Derive the AssetType bucket folder from a MIME type. */
function assetTypeFromMime(mimeType) {
    if (mimeType.startsWith('video/'))
        return 'videos';
    if (mimeType.startsWith('audio/'))
        return 'audios';
    return 'images';
}
//# sourceMappingURL=paths.js.map
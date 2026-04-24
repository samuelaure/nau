import type { AssetType } from './types';

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

export const flownau = {
  /** Creator account asset (video, audio, image). */
  accountAsset: (accountId: string, type: AssetType, assetId: string, ext: string) =>
    `flownau/accounts/${accountId}/assets/${type}/${assetId}.${ext}`,

  /** Thumbnail co-located with a video or image asset. */
  accountThumbnail: (accountId: string, assetId: string) =>
    `flownau/accounts/${accountId}/assets/thumbnails/${assetId}.jpg`,

  /** Remotion render output video. */
  renderOutput: (accountId: string, renderId: string) =>
    `flownau/accounts/${accountId}/outputs/${renderId}.mp4`,

  /** Cover image extracted from a render output. */
  renderCover: (accountId: string, renderId: string) =>
    `flownau/accounts/${accountId}/outputs/${renderId}_cover.jpg`,

  /** Still image render output. */
  renderStill: (accountId: string, renderId: string) =>
    `flownau/accounts/${accountId}/outputs/${renderId}.png`,

  /** Asset belonging to a template. Use 'global' as templateId for platform-wide templates. */
  templateAsset: (templateId: string, assetId: string, ext: string) =>
    `flownau/templates/${templateId}/assets/${assetId}.${ext}`,

  /** Thumbnail for a template asset. */
  templateThumbnail: (templateId: string, assetId: string) =>
    `flownau/templates/${templateId}/assets/thumbnails/${assetId}.jpg`,

  /**
   * User profile avatar.
   * Overwrites in place — no timestamp suffix — so old versions never accumulate.
   */
  profileAvatar: (userId: string, ext: string) =>
    `flownau/profiles/${userId}/avatar.${ext}`,
};

// ---------------------------------------------------------------------------
// nauthenticity
// ---------------------------------------------------------------------------

export const nauthenticity = {
  /**
   * Raw Instagram download before optimization.
   * Must be deleted by the optimization worker after processing.
   * R2 lifecycle rule on nauthenticity/raw/ provides a 7-day safety net.
   */
  rawPost: (username: string, mediaId: string, ext: string) =>
    `nauthenticity/raw/${username}/posts/${mediaId}.${ext}`,

  /** Optimized post media (permanent). */
  post: (username: string, mediaId: string, ext: string) =>
    `nauthenticity/content/${username}/posts/${mediaId}.${ext}`,

  /**
   * Profile picture. Overwrites in place — no timestamp suffix.
   */
  profilePic: (username: string, ext: string) =>
    `nauthenticity/content/${username}/profile.${ext}`,
};

// ---------------------------------------------------------------------------
// 9nau
// ---------------------------------------------------------------------------

export const nau = {
  /** User media capture (migrated from Telegram Vault or uploaded from mobile). */
  userCapture: (userId: string, blockId: string, ext: string) =>
    `9nau/users/${userId}/captures/${blockId}.${ext}`,

  /**
   * User profile avatar. Overwrites in place — no timestamp suffix.
   */
  userAvatar: (userId: string, ext: string) =>
    `9nau/users/${userId}/avatar.${ext}`,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the file extension from a MIME type. Returns '' if unknown. */
export function extFromMime(mimeType: string): string {
  const map: Record<string, string> = {
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
export function assetTypeFromMime(mimeType: string): AssetType {
  if (mimeType.startsWith('video/')) return 'videos';
  if (mimeType.startsWith('audio/')) return 'audios';
  return 'images';
}

import { logger } from './logger';

// ANSI escape codes
const R = '\x1b[0m'; // reset

const TAGS = {
  download:  '\x1b[36m[⬇  DOWNLOAD ]\x1b[0m',  // cyan
  optimize:  '\x1b[33m[⚡ OPTIMIZE ]\x1b[0m',  // yellow
  thumbnail: '\x1b[32m[🖼  THUMB   ]\x1b[0m',  // green
  transcribe:'\x1b[35m[🎤 TRANSCRIBE]\x1b[0m', // magenta
  embed:     '\x1b[34m[🧠 EMBED    ]\x1b[0m',  // blue
  profile:   '\x1b[38;5;214m[👤 PROFILE ]\x1b[0m', // orange
  ingest:    '\x1b[38;5;201m[🔍 INGEST  ]\x1b[0m', // pink
  info:      '\x1b[90m[ℹ  INFO    ]\x1b[0m',  // gray
  error:     '\x1b[31m[✗  ERROR   ]\x1b[0m',  // red
  warn:      '\x1b[38;5;208m[⚠  WARN    ]\x1b[0m', // orange-red
} as const;

type TagKey = keyof typeof TAGS;

function tag(type: TagKey, msg: string) {
  return `${TAGS[type]} ${msg}`;
}

function urlShort(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    // Show last 3 path segments to keep it readable
    return `…/${parts.slice(-3).join('/')}`;
  } catch {
    return url.slice(-60);
  }
}

export const wlog = {
  download: {
    start: (username: string, mediaId: string, type: string, sourceUrl: string, targetKey: string) =>
      logger.info(tag('download', `@${username} | ${type.toUpperCase()} | src: ${urlShort(sourceUrl)} → r2: ${urlShort(targetKey)}`)),
    done: (mediaId: string, publicUrl: string) =>
      logger.info(tag('download', `done | ${urlShort(publicUrl)}`)),
    skip: (mediaId: string, reason: string) =>
      logger.info(tag('download', `skip ${mediaId} — ${reason}`)),
    error: (mediaId: string, err: unknown) =>
      logger.error(tag('error', `DOWNLOAD ${mediaId} — ${err}`)),
  },

  optimize: {
    start: (username: string, mediaId: string, type: string, rawUrl: string, destKey: string) =>
      logger.info(tag('optimize', `@${username} | ${type.toUpperCase()} | ${urlShort(rawUrl)} → ${urlShort(destKey)}`)),
    done: (mediaId: string, publicUrl: string) =>
      logger.info(tag('optimize', `done | ${urlShort(publicUrl)}`)),
    skip: (mediaId: string, reason: string) =>
      logger.info(tag('optimize', `skip ${mediaId} — ${reason}`)),
    error: (mediaId: string, err: unknown) =>
      logger.error(tag('error', `OPTIMIZE ${mediaId} — ${err}`)),
  },

  thumbnail: {
    start: (username: string, mediaId: string, type: string, sourceUrl: string) =>
      logger.info(tag('thumbnail', `@${username} | ${type.toUpperCase()} | src: ${urlShort(sourceUrl)}`)),
    done: (mediaId: string, thumbUrl: string) =>
      logger.info(tag('thumbnail', `done | ${urlShort(thumbUrl)}`)),
    skip: (mediaId: string, reason: string) =>
      logger.info(tag('thumbnail', `skip ${mediaId} — ${reason}`)),
    error: (mediaId: string, err: unknown) =>
      logger.error(tag('error', `THUMBNAIL ${mediaId} — ${err}`)),
  },

  transcribe: {
    start: (username: string, mediaId: string, sourceUrl: string) =>
      logger.info(tag('transcribe', `@${username} | src: ${urlShort(sourceUrl)}`)),
    done: (mediaId: string, words: number) =>
      logger.info(tag('transcribe', `done | ${words} words`)),
    skip: (mediaId: string, reason: string) =>
      logger.info(tag('transcribe', `skip ${mediaId} — ${reason}`)),
    error: (mediaId: string, err: unknown) =>
      logger.error(tag('error', `TRANSCRIBE ${mediaId} — ${err}`)),
  },

  embed: {
    start: (mediaId: string) =>
      logger.info(tag('embed', `embedding ${mediaId}`)),
    done: (mediaId: string) =>
      logger.info(tag('embed', `done ${mediaId}`)),
    error: (mediaId: string, err: unknown) =>
      logger.error(tag('error', `EMBED ${mediaId} — ${err}`)),
  },

  profile: {
    start: (username: string, sourceUrl: string) =>
      logger.info(tag('profile', `@${username} | src: ${urlShort(sourceUrl)}`)),
    done: (username: string, publicUrl: string) =>
      logger.info(tag('profile', `done @${username} | ${urlShort(publicUrl)}`)),
    error: (username: string, err: unknown) =>
      logger.error(tag('error', `PROFILE @${username} — ${err}`)),
  },

  ingest: {
    info: (msg: string) => logger.info(tag('ingest', msg)),
    error: (msg: string, err: unknown) => logger.error(tag('error', `INGEST ${msg} — ${err}`)),
  },

  phase: (phase: string, runId: string, msg?: string) =>
    logger.info(tag('info', `[${phase.toUpperCase()}] run=${runId.slice(-8)}${msg ? ' | ' + msg : ''}`)),

  warn: (msg: string) => logger.warn(tag('warn', msg)),
};

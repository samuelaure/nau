import { ZazuSkill, ZazuContext } from '@zazu/skills-core'
import { logger } from './lib/logger'
import { buildServiceHeaders } from './lib/service-auth'

const NAU_API_URL = process.env.NAU_API_URL ?? 'http://api:3000'
const MAKE_YOUTUBE_WEBHOOK_URL = process.env.MAKE_YOUTUBE_WEBHOOK_URL ?? ''

// ── Feature gate ──────────────────────────────────────────────────────────────

const HARDCODED_ALLOWED_EMAIL = 'andiclinaz@gmail.com'

/**
 * Checks whether the user is allowed to use the YouTube digest feature.
 *
 * Permission ladder (easy to promote when ready):
 *  1. User has `youtube_digest` feature row in DB (UserFeature table) — covers future rollout to all users.
 *  2. User's linked naŭ account email is the hardcoded allowlist entry — current one-user phase.
 *
 * To promote to "all users": flip the `youtube_digest` Feature seed to be granted globally,
 * or remove this gate entirely from `canHandle`.
 */
async function hasYouTubeDigestAccess(ctx: ZazuContext): Promise<boolean> {
  // Phase 1: DB feature flag (UserFeature table)
  const activeFeatureIds: string[] = ctx.dbUser?.features?.map((f: any) => f.featureId) ?? []
  if (activeFeatureIds.includes('youtube_digest')) return true

  // Phase 2: Hardcoded email check via naŭ API
  const nauUserId = ctx.dbUser?.nauUserId
  if (!nauUserId) return false

  try {
    const headers = await buildServiceHeaders('9nau-api')
    const res = await fetch(`${NAU_API_URL}/auth/lookup?email=${encodeURIComponent(HARDCODED_ALLOWED_EMAIL)}`, {
      headers,
    })
    if (!res.ok) return false
    const user = await res.json() as { id?: string }
    return user?.id === nauUserId
  } catch (err) {
    logger.warn({ err }, '[YouTubeSkill] Failed to check email against naŭ API')
    return false
  }
}

// ── YouTube URL detection ──────────────────────────────────────────────────────

const YOUTUBE_REGEX =
  /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i

function extractYouTubeUrl(text: string): string | null {
  const match = text.match(YOUTUBE_REGEX)
  if (!match) return null
  // Return the full matched URL (not just the video ID)
  return match[0].startsWith('http') ? match[0] : `https://${match[0]}`
}

// ── Skill ─────────────────────────────────────────────────────────────────────

class YouTubeDigestSkillImpl implements ZazuSkill {
  id = 'youtube_digest'
  name = 'YouTube Video Digester'
  priority = 10 // High priority — runs before voicenote, triage, conversational

  async canHandle(ctx: ZazuContext): Promise<boolean> {
    if (ctx.dbUser?.onboardingState !== 'COMPLETED') return false
    const text = ctx.textContent
    if (!text) return false
    if (!extractYouTubeUrl(text)) return false
    return hasYouTubeDigestAccess(ctx)
  }

  async handle(ctx: ZazuContext): Promise<void> {
    const text = ctx.textContent ?? ''
    const youtubeUrl = extractYouTubeUrl(text)
    if (!youtubeUrl) return

    const telegramId = ctx.dbUser?.telegramId?.toString() ?? ''
    const zazuUserId = ctx.dbUser?.id ?? ''

    const statusMsg = await ctx.reply('⏳ Recibido. Estoy procesando el video de YouTube...')

    if (!MAKE_YOUTUBE_WEBHOOK_URL) {
      logger.error('[YouTubeSkill] MAKE_YOUTUBE_WEBHOOK_URL is not configured')
      await ctx.telegram.editMessageText(
        statusMsg.chat.id,
        statusMsg.message_id,
        undefined,
        '❌ El servicio de digestión de YouTube no está configurado. Contacta al administrador.',
      )
      return
    }

    try {
      const payload = {
        youtubeUrl,
        telegramId,
        zazuUserId,
        callbackUrl: 'https://zazu.9nau.com/api/internal/make-callback',
        requestedAt: new Date().toISOString(),
        source: 'telegram',
      }

      const res = await fetch(MAKE_YOUTUBE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        throw new Error(`Make.com webhook returned HTTP ${res.status}`)
      }

      await ctx.telegram.editMessageText(
        statusMsg.chat.id,
        statusMsg.message_id,
        undefined,
        '✅ Enlace recibido. Estoy transcribiendo y digiriendo el video. Te avisaré cuando esté listo.',
      )

      logger.info({ youtubeUrl, telegramId }, '[YouTubeSkill] Webhook triggered successfully')
    } catch (err) {
      logger.error({ err, youtubeUrl }, '[YouTubeSkill] Failed to trigger Make.com webhook')
      await ctx.telegram.editMessageText(
        statusMsg.chat.id,
        statusMsg.message_id,
        undefined,
        '❌ No pude enviar el video para procesarlo. Intenta de nuevo más tarde.',
      )
    }
  }
}

export const youtubeDigestSkill = new YouTubeDigestSkillImpl()

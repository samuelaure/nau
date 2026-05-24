import { ZazuSkill, ZazuContext } from '@zazu/skills-core'
import { logger } from './lib/logger'

const MAKE_YOUTUBE_WEBHOOK_URL = process.env.MAKE_YOUTUBE_WEBHOOK_URL ?? ''


/**
 * Checks whether the user is allowed to use the YouTube digest feature.
 *
 * Access is controlled via the `UserFeature` table (featureId = 'youtube_digest').
 * The `Feature` + `UserFeature` rows are seeded directly in the production DB.
 *
 * Promotion ladder:
 *  - Current: single user has the UserFeature row seeded manually
 *  - Next:    seed UserFeature for more users, or expose an admin UI
 *  - Future:  remove this gate entirely and let all users access it
 */
function hasYouTubeDigestAccess(ctx: ZazuContext): boolean {
  const activeFeatureIds: string[] = ctx.dbUser?.features?.map((f: any) => f.featureId) ?? []
  return activeFeatureIds.includes('youtube_digest')
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

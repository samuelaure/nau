import { ZazuSkill, ZazuContext } from '@zazu/skills-core'
import axios from 'axios'
import prisma from '@zazu/db'
import { logger } from './lib/logger'
import { buildServiceHeaders } from './lib/service-auth'
import { getStorage } from './lib/storage'

const NAUTHENTICITY_URL = process.env.NAUTHENTICITY_URL ?? 'http://nauthenticity:3000'
const NAU_API_URL = process.env.NAU_API_URL ?? 'http://api:3000'

type Brand = { id: string; name: string }

function buildSummaryMessage(results: Array<{ brandName: string; ideaCount: number }>): string {
  const lines = results.map((r) => `\\- ${r.ideaCount} nuevas ideas para *${escapeMarkdown(r.brandName)}*`)
  return `✅ Captura enviada\\. Se generaron:\n${lines.join('\n')}`
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&')
}

class VoicenoteSkillImpl implements ZazuSkill {
  id = 'voicenote-capture'
  name = 'Voicenote Capture'
  priority = 1010

  async canHandle(ctx: ZazuContext): Promise<boolean> {
    if (!ctx.message || !('voice' in ctx.message)) return false
    return ctx.dbUser?.onboardingState === 'COMPLETED' && !!ctx.dbUser?.nauUserId
  }

  async handle(ctx: ZazuContext): Promise<void> {
    const user = ctx.dbUser
    const voice = (ctx.message as any).voice

    const statusMsg = await ctx.reply('🎙️ Procesando tu nota de voz...')
    const chatId = statusMsg.chat.id
    const msgId = statusMsg.message_id

    const editStatus = (text: string) =>
      ctx.telegram.editMessageText(chatId, msgId, undefined, text, { parse_mode: 'Markdown' }).catch(() => {})

    try {
      // Download from Telegram
      const file = await ctx.telegram.getFile(voice.file_id)
      const telegramFileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`
      const audioResp = await axios.get(telegramFileUrl, { responseType: 'arraybuffer', timeout: 30_000 })
      const audioBuffer = Buffer.from(audioResp.data)

      // Upload to nau_storage under zazu folder
      const storage = getStorage()
      const storageKey = `zazu/voicenotes/${user.telegramId}/${crypto.randomUUID()}.ogg`
      const audioUrl = await storage.upload(storageKey, audioBuffer, { mimeType: 'audio/ogg' })

      // Send to nauthenticity for transcription + synthesis
      const nautHeaders = await buildServiceHeaders('nauthenticity')
      const processResp = await axios.post(
        `${NAUTHENTICITY_URL}/api/v1/_service/audio/process`,
        { audioUrl },
        { headers: nautHeaders, timeout: 60_000 },
      )
      const { rawTranscription, cleanTranscription, synthesis } = processResp.data

      // Store in zazu DB
      const voicenote = await prisma.voicenote.create({
        data: { userId: user.id, audioStorageUrl: audioUrl, rawTranscription, cleanTranscription, synthesis },
      })

      // Fetch user's brands
      const apiHeaders = await buildServiceHeaders('9nau-api')
      const wsResp = await axios.get(`${NAU_API_URL}/_service/workspaces?userId=${user.nauUserId}`, { headers: apiHeaders })
      const brands: Brand[] = (wsResp.data as Array<{ brands: Brand[] }>).flatMap((w) => w.brands)

      if (brands.length === 0) {
        await editStatus('No tienes marcas configuradas. Crea una marca primero.')
        return
      }

      if (brands.length === 1) {
        await editStatus(`⏳ Enviando captura a *${brands[0].name}*\\.\\.\\.`)
        const results = await this.dispatchToBrands(voicenote.id, cleanTranscription, synthesis, brands)
        await editStatus(buildSummaryMessage(results))
        return
      }

      // Multi-brand selection keyboard — processing message stays, keyboard is a new message
      ctx.session ??= {}
      ctx.session.pendingVoicenoteId = voicenote.id
      ctx.session.pendingVoicenoteClean = cleanTranscription
      ctx.session.pendingVoicenoteSynthesis = synthesis
      ctx.session.pendingVoicenoteBrands = brands
      ctx.session.selectedVoicenoteBrandIds = []

      await editStatus('🎙️ Nota procesada. ¿A qué marca\\(s\\) enviamos esta captura?')

      const brandButtons = brands.map((b) => ([{
        text: `☐ ${b.name}`,
        callback_data: `vnote_brand_${b.id}`,
      }]))

      await ctx.reply('Selecciona marca(s):', {
        reply_markup: {
          inline_keyboard: [
            ...brandButtons,
            [
              { text: '✅ Todas', callback_data: 'vnote_all' },
              { text: '▶️ Confirmar', callback_data: 'vnote_confirm' },
            ],
          ],
        },
      })
    } catch (err) {
      logger.error({ err }, '[VoicenoteSkill] Error processing voicenote')
      await editStatus('❌ Error al procesar la nota de voz. Intenta de nuevo.')
    }
  }

  async dispatchToBrands(
    voicenoteId: string,
    cleanTranscription: string,
    synthesis: string,
    brands: Brand[],
  ): Promise<Array<{ brandName: string; ideaCount: number }>> {
    const headers = await buildServiceHeaders('nauthenticity')
    const results = await Promise.all(
      brands.map(async (brand) => {
        try {
          const res = await axios.post<{ ideaCount: number }>(
            `${NAUTHENTICITY_URL}/api/v1/_service/brands/${brand.id}/voicenotes`,
            { cleanTranscription, synthesis, sourceRef: voicenoteId },
            { headers, timeout: 120_000 },
          )
          return { brandName: brand.name, ideaCount: res.data?.ideaCount ?? 0 }
        } catch (err) {
          logger.error({ err, brandId: brand.id }, '[VoicenoteSkill] Failed to dispatch to brand')
          return { brandName: brand.name, ideaCount: 0 }
        }
      }),
    )
    return results
  }
}

export const voicenoteSkill = new VoicenoteSkillImpl()

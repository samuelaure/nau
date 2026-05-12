import { ZazuSkill, ZazuContext } from '@zazu/skills-core'
import axios from 'axios'
import prisma from '@zazu/db'
import { logger } from './lib/logger'
import { buildServiceHeaders } from './lib/service-auth'
import { getStorage } from './lib/storage'

const NAUTHENTICITY_URL = process.env.NAUTHENTICITY_URL ?? 'http://nauthenticity:3000'
const NAU_API_URL = process.env.NAU_API_URL ?? 'http://api:3000'

type Brand = { id: string; name: string }

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

    await ctx.reply('🎙️ Procesando tu nota de voz...')

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
        await ctx.reply('No tienes marcas configuradas. Crea una marca primero.')
        return
      }

      if (brands.length === 1) {
        await this.dispatchToBrands(voicenote.id, cleanTranscription, synthesis, [brands[0].id])
        await ctx.reply(`✅ Captura enviada a *${brands[0].name}*. Las ideas se están generando.`, { parse_mode: 'Markdown' })
        return
      }

      // Multi-brand selection keyboard
      ctx.session.pendingVoicenoteId = voicenote.id
      ctx.session.pendingVoicenoteClean = cleanTranscription
      ctx.session.pendingVoicenoteSynthesis = synthesis
      ctx.session.pendingVoicenoteBrands = brands
      ctx.session.selectedVoicenoteBrandIds = []

      const brandButtons = brands.map((b) => ([{
        text: `☐ ${b.name}`,
        callback_data: `vnote_brand_${b.id}`,
      }]))

      await ctx.reply('¿A qué marca(s) enviamos esta captura?', {
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
      await ctx.reply('❌ Error al procesar la nota de voz. Intenta de nuevo.')
    }
  }

  async dispatchToBrands(
    voicenoteId: string,
    cleanTranscription: string,
    synthesis: string,
    brandIds: string[],
  ): Promise<void> {
    const headers = await buildServiceHeaders('nauthenticity')
    await Promise.all(
      brandIds.map((brandId) =>
        axios
          .post(
            `${NAUTHENTICITY_URL}/api/v1/_service/brands/${brandId}/voicenotes`,
            { cleanTranscription, synthesis, sourceRef: voicenoteId },
            { headers, timeout: 120_000 },
          )
          .catch((err) => logger.error({ err, brandId }, '[VoicenoteSkill] Failed to dispatch to brand')),
      ),
    )
  }
}

export const voicenoteSkill = new VoicenoteSkillImpl()

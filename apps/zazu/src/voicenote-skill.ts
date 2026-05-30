import { ZazuSkill, ZazuContext } from '@zazu/skills-core'
import axios from 'axios'
import { z } from 'zod'
import prisma from '@zazu/db'
import { logger } from './lib/logger'
import { buildServiceHeaders } from './lib/service-auth'
import { getStorage } from './lib/storage'
import { getClientForFeature } from '@nau/llm-client'

const NAUTHENTICITY_URL = process.env.NAUTHENTICITY_URL ?? 'http://nauthenticity:3000'
const NAU_API_URL = process.env.NAU_API_URL ?? 'http://api:3000'

type Brand = { id: string; name: string }
type Workspace = { id: string; name: string }

// ── LLM schema for intent splitting ───────────────────────────────────────────
const VoicenoteSplitSchema = z.object({
  journal_entry: z
    .string()
    .nullable()
    .describe('Text applicable to a personal journal entry — thoughts, feelings, reflections. Null if none.'),
  content_idea: z
    .string()
    .nullable()
    .describe('Text applicable as a brand content idea or hook. Null if none.'),
})

type VoicenoteSplit = z.infer<typeof VoicenoteSplitSchema>

// ── Summary builders ──────────────────────────────────────────────────────────
function buildSummaryMessage(results: Array<{ brandName: string; ideaCount: number }>): string {
  const lines = results.map((r) => `\\- ${r.ideaCount} nuevas ideas para *${escapeMarkdown(r.brandName)}*`)
  return `✅ Nota de voz enviada\\. Se generaron:\\n${lines.join('\n')}`
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&')
}

// ── Keyboard builders ─────────────────────────────────────────────────────────
function buildBrandKeyboard(brands: Brand[], selected: string[]) {
  const brandButtons = brands.map((b) => ([{
    text: selected.includes(b.id) ? `✅ ${b.name}` : `☐ ${b.name}`,
    callback_data: `vnote_brand_${b.id}`,
  }]))
  return {
    inline_keyboard: [
      ...brandButtons,
      [
        { text: '✅ Todas', callback_data: 'vnote_all' },
        { text: '▶️ Confirmar', callback_data: 'vnote_confirm' },
      ],
    ],
  }
}

function buildWorkspaceKeyboard(workspaces: Workspace[], selected: string[]) {
  const wsButtons = workspaces.map((w) => ([{
    text: selected.includes(w.id) ? `✅ ${w.name}` : `☐ ${w.name}`,
    callback_data: `vnote_ws_${w.id}`,
  }]))
  return {
    inline_keyboard: [
      ...wsButtons,
      [{ text: '▶️ Confirmar', callback_data: 'vnote_ws_confirm' }],
    ],
  }
}

// ── Skill ─────────────────────────────────────────────────────────────────────
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

    ctx.session ??= {}
    ctx.session.selectedVoicenoteBrandIds = []
    ctx.session.selectedVoicenoteWorkspaceIds = []
    ctx.session.selectedVoicenoteIntents = []
    ctx.session.pendingVoicenoteId = undefined
    ctx.session.pendingVoicenoteClean = undefined
    ctx.session.pendingVoicenoteSynthesis = undefined
    ctx.session.pendingVoicenoteBrands = []
    ctx.session.pendingVoicenoteWorkspaces = []
    ctx.session.voicenoteProcessError = undefined

    const statusMsg = await ctx.reply('¿Qué contiene esta nota de voz?', {
      parse_mode: 'MarkdownV2',
      reply_markup: {
        inline_keyboard: [
          [{ text: '☐ 📓 Diario (Journal)', callback_data: 'vnote_triage_journal' }],
          [{ text: '☐ 💡 Idea de Contenido', callback_data: 'vnote_triage_content' }],
          [{ text: '▶️ Confirmar', callback_data: 'vnote_triage_confirm' }],
        ],
      },
    })
    const chatId = statusMsg.chat.id
    const msgId = statusMsg.message_id
    
    ctx.session.voicenoteMessageId = msgId
    ctx.session.voicenoteChatId = chatId

    ctx.session.voicenoteProcessPromise = (async () => {
      try {
        const file = await ctx.telegram.getFile(voice.file_id)
        const telegramFileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`
        const audioResp = await axios.get(telegramFileUrl, { responseType: 'arraybuffer', timeout: 30_000 })
        const audioBuffer = Buffer.from(audioResp.data)

        const storage = getStorage()
        const storageKey = `zazu/voicenotes/${user.telegramId}/${crypto.randomUUID()}.ogg`
        const audioUrl = await storage.upload(storageKey, audioBuffer, { mimeType: 'audio/ogg' })

        const nautHeaders = await buildServiceHeaders('nauthenticity')
        const processResp = await axios.post(
          `${NAUTHENTICITY_URL}/api/v1/_service/audio/process`,
          { audioUrl },
          { headers: nautHeaders, timeout: 60_000 },
        )
        const { rawTranscription, cleanTranscription, synthesis } = processResp.data

        const voicenote = await prisma.voicenote.create({
          data: { userId: user.id, audioStorageUrl: audioUrl, rawTranscription, cleanTranscription, synthesis },
        })

        const apiHeaders = await buildServiceHeaders('9nau-api')
        const wsResp = await axios.get(`${NAU_API_URL}/_service/workspaces?userId=${user.nauUserId}`, { headers: apiHeaders })
        const wsData = wsResp.data as Array<{ id: string; name: string; brands: Brand[] }>
        const workspaces: Workspace[] = wsData.map((w) => ({ id: w.id, name: w.name }))
        const brands: Brand[] = wsData.flatMap((w) => w.brands)

        ctx.session.pendingVoicenoteId = voicenote.id
        ctx.session.pendingVoicenoteClean = cleanTranscription
        ctx.session.pendingVoicenoteSynthesis = synthesis
        ctx.session.pendingVoicenoteBrands = brands
        ctx.session.pendingVoicenoteWorkspaces = workspaces
      } catch (err) {
        logger.error({ err }, '[VoicenoteSkill] Error processing voicenote in background')
        ctx.session.voicenoteProcessError = true
        await ctx.telegram.editMessageText(
          chatId,
          msgId,
          undefined,
          '❌ Error al procesar la nota de voz. Intenta de nuevo.',
          { parse_mode: 'Markdown' }
        ).catch(() => {})
      }
    })()
  }

  /**
   * Dispatches clean transcription to one or more brands in nauthenticity.
   */
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

  /**
   * Dispatches clean transcription to nau-api as a journal entry.
   */
  async dispatchToJournal(
    voicenoteId: string,
    cleanTranscription: string,
    workspaceId: string,
    nauUserId: string,
  ): Promise<void> {
    const headers = await buildServiceHeaders('9nau-api')
    await axios.post(
      `${NAU_API_URL}/triage`,
      {
        text: cleanTranscription,
        userId: nauUserId,
        sourceBlockId: voicenoteId,
        workspaceId,
        journalOnly: true,
      },
      { headers, timeout: 60_000 },
    )
  }

  /**
   * Calls the LLM to split a transcription into journal vs content idea text.
   * Uses the voicenote_split feature (gpt-4o-mini).
   */
  async splitIntent(cleanTranscription: string): Promise<VoicenoteSplit> {
    const { client, model } = getClientForFeature('voicenote_split')
    const result = await client.parseCompletion({
      model,
      temperature: 0.1,
      schema: VoicenoteSplitSchema as any,
      schemaName: 'VoicenoteSplit',
      messages: [
        {
          role: 'system',
          content: `You receive a voice transcription that contains both personal reflections AND content ideas.
Your task: separate them into two distinct outputs.

- "journal_entry": personal thoughts, feelings, plans, reflections, life observations. Return null if there is nothing personal.
- "content_idea": ideas for social media content, hooks, topics, angles for a brand or creator. Return null if there are no content ideas.

Rules:
- Keep the full meaning of each part. Do not summarize or shorten unless necessary.
- Write in the same language as the input.
- Return valid JSON matching the schema.`,
        },
        { role: 'user', content: cleanTranscription },
      ],
    })
    return result.data as VoicenoteSplit
  }
}

export const voicenoteSkill = new VoicenoteSkillImpl()
export { buildSummaryMessage, buildBrandKeyboard, buildWorkspaceKeyboard, escapeMarkdown }
export type { Brand, Workspace }

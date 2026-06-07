import { ZazuSkill, ZazuContext } from '@zazu/skills-core'
import axios from 'axios'
import { z } from 'zod'
import prisma from '@zazu/db'
import { logger } from './lib/logger'
import { buildServiceHeaders } from './lib/service-auth'
import { getStorage } from './lib/storage'
import { getClientForFeature, getFeatureFallbackChain } from '@nau/llm-client'
import { withRetry } from './lib/retry'
import fs from 'fs'
import os from 'os'
import path from 'path'

const NAUTHENTICITY_URL = process.env.NAUTHENTICITY_URL ?? 'http://nauthenticity:3000'
const NAU_API_URL = process.env.NAU_API_URL ?? 'http://api:3000'

type Brand = { id: string; name: string }
type Workspace = { id: string; name: string }



// ── Summary builders ──────────────────────────────────────────────────────────
function buildSummaryMessage(results: Array<{ brandName: string; ideaCount: number }>): string {
  const lines = results.map((r) => `\\- ${r.ideaCount} nuevas ideas para *${escapeMarkdown(r.brandName)}*`)
  return `✅ Nota de voz procesada\\. Se generaron:\\n${lines.join('\n')}`
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

function buildWorkspaceKeyboard(workspaces: Workspace[], selected: string[], intent: 'journal' | 'actions' = 'journal') {
  const prefix = intent === 'journal' ? 'vnote_ws_journal_' : 'vnote_ws_actions_';
  const confirmData = intent === 'journal' ? 'vnote_ws_journal_confirm' : 'vnote_ws_actions_confirm';
  const wsButtons = workspaces.map((w) => ([{
    text: selected.includes(w.id) ? `✅ ${w.name}` : `☐ ${w.name}`,
    callback_data: `${prefix}${w.id}`,
  }]))
  return {
    inline_keyboard: [
      ...wsButtons,
      [{ text: '▶️ Confirmar', callback_data: confirmData }],
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
    ctx.session.selectedVoicenoteJournalWorkspaceId = undefined
    ctx.session.selectedVoicenoteActionsWorkspaceId = undefined
    ctx.session.selectedVoicenoteIntents = []
    ctx.session.pendingVoicenoteId = undefined
    ctx.session.pendingVoicenoteClean = undefined
    ctx.session.pendingVoicenoteSummary = undefined
    ctx.session.pendingVoicenoteBrands = []
    ctx.session.pendingVoicenoteWorkspaces = []
    ctx.session.voicenoteProcessError = undefined

    const apiHeaders = await buildServiceHeaders('9nau-api')
    const wsResp = await axios.get(`${NAU_API_URL}/_service/workspaces?userId=${user.nauUserId}`, { headers: apiHeaders })
    const wsData = wsResp.data as Array<{ id: string; name: string; brands: Brand[] }>
    const workspaces: Workspace[] = wsData.map((w) => ({ id: w.id, name: w.name }))
    const brands: Brand[] = wsData.flatMap((w) => w.brands)

    ctx.session.pendingVoicenoteBrands = brands
    ctx.session.pendingVoicenoteWorkspaces = workspaces

    const statusMsg = await ctx.reply('¿Qué contiene esta nota de voz?', {
      parse_mode: 'MarkdownV2',
      reply_markup: {
        inline_keyboard: [
          [{ text: '☐ 📓 Diario (Journal)', callback_data: 'vnote_triage_journal' }],
          [{ text: '☐ 🎯 Tareas (Actions)', callback_data: 'vnote_triage_actions' }],
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
        // Wrap getFile + download in retry — Telegram occasionally returns
        // "400: temporarily unavailable" for valid files due to transient glitches.
        const { audioBuffer } = await withRetry(
          async () => {
            const file = await ctx.telegram.getFile(voice.file_id)
            const telegramFileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`
            const audioResp = await axios.get(telegramFileUrl, { responseType: 'arraybuffer', timeout: 60_000 })
            return { audioBuffer: Buffer.from(audioResp.data) }
          },
          { retries: 3, baseDelayMs: 2000, label: 'getFile+download' },
        )

        const storage = getStorage()
        const storageKey = `zazu/voicenotes/${user.telegramId}/${crypto.randomUUID()}.ogg`
        const audioUrl = await storage.upload(storageKey, audioBuffer, { mimeType: 'audio/ogg' })

        // Save buffer to tmp file
        const tmpPath = path.join(os.tmpdir(), `nau-voice-${crypto.randomUUID()}.ogg`)
        fs.writeFileSync(tmpPath, audioBuffer)

        let rawTranscription = ''
        try {
          const chain = getFeatureFallbackChain('transcription')
          let lastError: unknown
          for (const { client, model } of chain) {
            try {
              const result = await client.transcribe({ model, file: fs.createReadStream(tmpPath) })
              rawTranscription = result.text
              break
            } catch (err) {
              lastError = err
            }
          }
          if (!rawTranscription) throw lastError
        } finally {
          fs.rmSync(tmpPath, { force: true })
        }

        const { client, model } = getClientForFeature('synthesis')
        const result = await client.chatCompletion({
          model,
          temperature: 0.3,
          messages: [
            {
              role: 'system',
              content: `You receive a raw voice transcription. Return JSON with two fields:
- "cleanTranscription": the transcription cleaned of filler words, repeated phrases, and disfluencies, with proper punctuation. Keep all meaning intact. Write in the same language as the input.
- "summary": a condensed re-narration of the voice note in the same language, person (first-person if the speaker uses it), and perspective as the original. Do NOT interpret, explain, or add context. Just faithfully compress the content into 2-4 sentences that capture all key points. Imagine the speaker re-reading a shorter version of what they said.

Return only valid JSON: { "cleanTranscription": "...", "summary": "..." }`,
            },
            { role: 'user', content: rawTranscription },
          ],
          responseFormat: { type: 'json_object' },
        })
        const parsed = z.object({ cleanTranscription: z.string(), summary: z.string() }).parse(JSON.parse(result.content as string))
        const { cleanTranscription, summary } = parsed

        const voicenote = await prisma.voicenote.create({
          data: { userId: user.id, audioStorageUrl: audioUrl, rawTranscription, cleanTranscription, summary },
        })

        ctx.session.pendingVoicenoteId = voicenote.id
        ctx.session.pendingVoicenoteClean = cleanTranscription
        ctx.session.pendingVoicenoteSummary = summary
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
    brands: Brand[],
  ): Promise<Array<{ brandName: string; ideaCount: number }>> {
    const headers = await buildServiceHeaders('nauthenticity')
    const results = await Promise.all(
      brands.map(async (brand) => {
        try {
          const res = await axios.post<{ ideaCount: number }>(
            `${NAUTHENTICITY_URL}/api/v1/_service/brands/${brand.id}/voicenotes`,
            { cleanTranscription, sourceRef: voicenoteId },
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

  async dispatchToActions(
    voicenoteId: string,
    actionText: string,
    workspaceId: string,
    nauUserId: string,
  ): Promise<any> {
    const headers = await buildServiceHeaders('9nau-api')
    const res = await axios.post(
      `${NAU_API_URL}/triage`,
      {
        text: actionText,
        userId: nauUserId,
        sourceBlockId: voicenoteId,
        workspaceId,
        journalOnly: false,
      },
      { headers, timeout: 60_000 },
    )
    return res.data
  }

  /**
   * Calls the LLM to split a transcription into selected intents.
   * Uses the voicenote_split feature (gpt-4o-mini).
   */
  async splitIntent(cleanTranscription: string, intents: string[]): Promise<any> {
    const { client, model } = getClientForFeature('voicenote_split')
    
    const fields: string[] = []
    const rules: string[] = []
    
    if (intents.includes('journal')) {
      fields.push('"journal_entry": string | null')
      rules.push('- "journal_entry": personal thoughts, feelings, reflections. null if none.')
    }
    if (intents.includes('actions')) {
      fields.push('"action_items": string | null')
      rules.push('- "action_items": concrete tasks, errands, or project steps. null if none.')
    }
    if (intents.includes('content')) {
      fields.push('"content_idea": string | null')
      rules.push('- "content_idea": ideas for social media content, hooks, topics, angles. null if none.')
    }

    const result = await client.chatCompletion({
      model,
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: `You receive a voice transcription. Extract relevant parts into these fields:

${rules.join('\n')}

Rules:
- Keep the full meaning of each part. Do not summarize unless necessary.
- Write in the same language as the input.
- Return valid JSON with only these keys: { ${fields.join(', ')} }
- Use null for fields with no relevant content.`,
        },
        { role: 'user', content: cleanTranscription },
      ],
      responseFormat: { type: 'json_object' },
    })
    return JSON.parse(result.content as string)
  }
}

export const voicenoteSkill = new VoicenoteSkillImpl()
export { buildSummaryMessage, buildBrandKeyboard, buildWorkspaceKeyboard, escapeMarkdown }
export type { Brand, Workspace }

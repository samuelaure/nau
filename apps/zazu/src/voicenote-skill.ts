import { ZazuSkill, ZazuContext } from '@zazu/skills-core'
import axios from 'axios'
import { z } from 'zod'
import prisma from '@zazu/db'
import { logger } from './lib/logger'
import { buildServiceHeaders } from './lib/service-auth'
import { getPrivateStorage } from './lib/storage'
import { getClientForFeature, getFeatureFallbackChain } from '@nau/llm-client'
import { withRetry } from './lib/retry'
import { extractYouTubeUrl, hasYouTubeDigestAccess } from './youtube-skill'
import type { TriageRequestDto } from '@nau/types'
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

/**
 * Builds the initial intent-selection keyboard (Journal / GTD / Content idea).
 *
 * DESACTIVADO TEMPORALMENTE (2026-08-27): la opción "Idea de Contenido" está
 * oculta para simplificar el flujo mientras se estabiliza journal + GTD. La
 * lógica y el dispatch de content (dispatchToBrands, vnote_brand_*, vnote_all,
 * vnote_confirm) siguen intactos — solo se dejó de ofrecer el botón de
 * entrada. Para reactivar: descomentar la fila `contentRow` más abajo.
 */
function buildIntentKeyboard(intents: string[]) {
  const journalRow = [{ text: intents.includes('journal') ? '✅ 📓 Journal' : '☐ 📓 Journal', callback_data: 'vnote_triage_journal' }]
  const actionsRow = [{ text: intents.includes('actions') ? '✅ 🎯 GTD' : '☐ 🎯 GTD', callback_data: 'vnote_triage_actions' }]
  // const contentRow = [{ text: intents.includes('content') ? '✅ 💡 Idea de Contenido' : '☐ 💡 Idea de Contenido', callback_data: 'vnote_triage_content' }]
  return {
    inline_keyboard: [
      journalRow,
      actionsRow,
      // contentRow,
      [{ text: '▶️ Confirmar', callback_data: 'vnote_triage_confirm' }],
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
//
// Handles both capture origins that feed the same in-chat distribution form:
// voice notes (transcribe → clean → summarize → distribute) and plain text
// (distribute only — see `handleText`). Both share the intent form, the
// workspace/brand resolution and the dispatch functions below; only the
// pre-form step differs.
class VoicenoteSkillImpl implements ZazuSkill {
  id = 'voicenote-capture'
  name = 'Voicenote Capture'
  priority = 1010

  async canHandle(ctx: ZazuContext): Promise<boolean> {
    const user = ctx.dbUser
    if (user?.onboardingState !== 'COMPLETED' || !user?.nauUserId) return false

    if (ctx.message && 'voice' in ctx.message) return true

    // Plain text: only claims it if nothing more specific already will.
    // YouTube links go to YouTubeDigestSkill when the user has that feature
    // active (checked here, not just relying on skill registration order,
    // because canHandle must reflect the same decision handle() would make).
    if (ctx.textContent && ctx.textContent.trim().length > 0) {
      const youtubeUrl = extractYouTubeUrl(ctx.textContent)
      if (youtubeUrl && hasYouTubeDigestAccess(ctx)) return false
      return true
    }

    return false
  }

  async handle(ctx: ZazuContext): Promise<void> {
    const isVoice = !!(ctx.message && 'voice' in ctx.message)
    if (isVoice) {
      await this.handleVoice(ctx)
    } else {
      await this.handleText(ctx)
    }
  }

  /**
   * Plain-text capture: no transcription, no clean-up, no summary — the text
   * is already what the user wrote. Starts the same in-chat distribution form
   * as voicenotes; `pendingVoicenoteClean` is set directly to the raw input so
   * the shared dispatch path (handleFinalDispatch in index.ts) needs no branch
   * on origin except for which confirmation message it sends.
   */
  async handleText(ctx: ZazuContext): Promise<void> {
    const text = ctx.textContent
    if (!text) return

    await this.resetSession(ctx)
    ctx.session.pendingVoicenoteOrigin = 'text'
    ctx.session.pendingVoicenoteClean = text
    ctx.session.pendingVoicenoteCapturedAt = ctx.message?.date
      ? new Date(ctx.message.date * 1000).toISOString()
      : new Date().toISOString()

    await this.startIntentForm(ctx)
  }

  private async resetSession(ctx: ZazuContext): Promise<void> {
    ctx.session ??= {}
    ctx.session.selectedVoicenoteBrandIds = []
    ctx.session.selectedVoicenoteJournalWorkspaceId = undefined
    ctx.session.selectedVoicenoteActionsWorkspaceId = undefined
    ctx.session.selectedVoicenoteIntents = []
    ctx.session.pendingVoicenoteId = undefined
    ctx.session.pendingVoicenoteCapturedAt = undefined
    ctx.session.pendingVoicenoteRaw = undefined
    ctx.session.pendingVoicenoteClean = undefined
    ctx.session.pendingVoicenoteSummary = undefined
    ctx.session.pendingVoicenoteBrands = []
    ctx.session.pendingVoicenoteWorkspaces = []
    ctx.session.voicenoteProcessError = undefined
    ctx.session.pendingVoicenoteOrigin = undefined
  }

  /**
   * Fetches the user's workspaces/brands and shows the intent-selection
   * keyboard. Shared by both the voice and text entry points.
   */
  private async startIntentForm(ctx: ZazuContext): Promise<{ chatId: number; msgId: number }> {
    const user = ctx.dbUser
    const apiHeaders = await buildServiceHeaders('9nau-api')
    const wsResp = await axios.get(`${NAU_API_URL}/_service/workspaces?userId=${user.nauUserId}`, { headers: apiHeaders })
    const wsData = wsResp.data as Array<{ id: string; name: string; brands: Brand[] }>
    const workspaces: Workspace[] = wsData.map((w) => ({ id: w.id, name: w.name }))
    const brands: Brand[] = wsData.flatMap((w) => w.brands)

    ctx.session.pendingVoicenoteBrands = brands
    ctx.session.pendingVoicenoteWorkspaces = workspaces

    const statusMsg = await ctx.reply('¿Qué contiene esto?', {
      reply_markup: buildIntentKeyboard([]),
    })
    const chatId = statusMsg.chat.id
    const msgId = statusMsg.message_id

    ctx.session.voicenoteMessageId = msgId
    ctx.session.voicenoteChatId = chatId

    return { chatId, msgId }
  }

  async handleVoice(ctx: ZazuContext): Promise<void> {
    const user = ctx.dbUser
    const voice = (ctx.message as any).voice

    await this.resetSession(ctx)
    ctx.session.pendingVoicenoteOrigin = 'voice'

    const { chatId, msgId } = await this.startIntentForm(ctx)

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

        // Private bucket, and the key is what gets stored — not a URL. A URL
        // bakes the delivery mechanism into the row; a key can be served later
        // as a presigned link, through a proxy, or however else suits.
        const storage = getPrivateStorage()
        const storageKey = `zazu/voicenotes/${user.telegramId}/${crypto.randomUUID()}.ogg`
        await storage.upload(storageKey, audioBuffer, { mimeType: 'audio/ogg' })

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
- "cleanTranscription": the same transcription, with filler words, false starts and repeated phrases removed, proper punctuation added, and broken into paragraphs. This is a transcription clean-up, NOT a rewrite: keep the speaker's own words, wording, order and language. Do not rephrase, do not condense, do not improve the style, do not add anything that was not said. If the speaker was already fluent, return the input essentially unchanged apart from punctuation and paragraphing.
  A raw transcription arrives as one unbroken block with no paragraph marks at all, regardless of how many separate thoughts it contains — a single voice note commonly drifts across several unrelated topics in one breath. Insert a paragraph break ("\\n\\n") wherever the speaker moves to a new topic, a new train of thought, or a natural pause a listener would hear as one. Do not merge distinct topics into one paragraph just because they were spoken without pause, and do not force one topic across a break. The result should read as an ordinary written paragraph structure, not as one wall of text.
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
          data: { userId: user.id, audioStorageUrl: storageKey, rawTranscription, cleanTranscription, summary },
        })

        ctx.session.pendingVoicenoteId = voicenote.id
        // Telegram's own timestamp for the message: the moment the note was
        // recorded, which is what the journal entry should be dated by. The
        // Voicenote row is created after transcription, so its createdAt is
        // already minutes late.
        ctx.session.pendingVoicenoteCapturedAt = ctx.message?.date
          ? new Date(ctx.message.date * 1000).toISOString()
          : new Date().toISOString()
        ctx.session.pendingVoicenoteRaw = rawTranscription
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
   *
   * // TODO: This is the correct shape for a module attached to Zazŭ's capture
   * // channel: receives the already-cleaned text, owns everything after that
   * // point. nauthenticity does its own thing with it from here — no shared
   * // triage call. Journal and future modules attaching to this channel
   * // should follow the same contract: clean text in, one pipeline, no
   * // request shared with another module's classification.
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
   *
   * No longer sends `rawText`: as of api's `81b3737c` a journal entry holds
   * one text field, and the untouched transcription already lives where it
   * belongs — Zazŭ's own `Voicenote.rawTranscription` row, reachable from the
   * entry through `sourceBlockId`. The API tolerated the field for a while
   * so the two services didn't have to deploy in lockstep, but it was never
   * read — see nau#43.
   */
  async dispatchToJournal(
    voicenoteId: string,
    cleanTranscription: string,
    workspaceId: string,
    nauUserId: string,
    capturedAt?: string,
  ): Promise<void> {
    const headers = await buildServiceHeaders('9nau-api')
    const body: TriageRequestDto = {
      text: cleanTranscription,
      userId: nauUserId,
      sourceBlockId: voicenoteId,
      workspaceId,
      journalOnly: true,
      // The moment the note was recorded. Without it the entry is dated when
      // the API happened to process it, which puts it on the wrong day
      // whenever ingestion lags.
      capturedAt: capturedAt ?? new Date().toISOString(),
    }
    await axios.post(`${NAU_API_URL}/triage`, body, { headers, timeout: 60_000 })
  }

  async dispatchToActions(
    voicenoteId: string,
    actionText: string,
    workspaceId: string,
    nauUserId: string,
  ): Promise<any> {
    const headers = await buildServiceHeaders('9nau-api')
    const body: TriageRequestDto = {
      text: actionText,
      userId: nauUserId,
      sourceBlockId: voicenoteId,
      workspaceId,
      journalOnly: false,
    }
    const res = await axios.post(`${NAU_API_URL}/triage`, body, { headers, timeout: 60_000 })
    return res.data
  }

  /**
   * Resolves the user's "Personal Workspace" from the list already fetched
   * for the form (`pendingVoicenoteWorkspaces`) — no extra request.
   *
   * DESACTIVADO TEMPORALMENTE (2026-08-27): the workspace-selection step
   * (step 2 of the in-chat form — `vnote_ws_journal_*` / `vnote_ws_actions_*`,
   * see index.ts) is skipped and this heuristic is used instead, to simplify
   * the flow while only one workspace per user matters in practice.
   *
   * THIS IS A NAME MATCH, NOT A REAL "IS PERSONAL" FLAG — there is no such
   * flag in the api schema. It matches on `name === 'Personal Workspace'`,
   * the literal string api's auth.service.ts stamps onto the workspace it
   * creates at signup. It breaks silently if that workspace is ever renamed,
   * or the moment a user has more than one workspace and needs to choose
   * between them for real. Safe today only because there is a single user
   * and workspace naming is fully under that same person's control.
   *
   * The correct fix, even after this exception is reverted, is NOT to
   * restore the manual keyboard by default — it's to have api expose the
   * already-existing `User.defaultWorkspaceId` (see
   * apps/api/src/auth/auth.service.ts) on `/_service/workspaces`, e.g. as an
   * `isDefault` flag per workspace or a dedicated
   * `/_service/workspaces/default?userId=` route, and have Zazŭ preselect
   * that one while still letting the person override it when they have more
   * than one workspace. That work is cross-module (api) — see the handoff
   * prompt drafted for the api/module:actions session on 2026-08-27.
   *
   * To reactivate manual selection: restore the `workspaces.length === 1`
   * branch and the `buildWorkspaceKeyboard` prompt in `handleTriageState`
   * (apps/zazu/src/index.ts) instead of calling this method.
   */
  resolvePersonalWorkspaceId(workspaces: Workspace[]): string | undefined {
    const personal = workspaces.find((w) => w.name === 'Personal Workspace')
    if (personal) return personal.id
    // Name match failed — falling back to the first workspace rather than
    // failing the dispatch outright, but this is exactly the silent-drift
    // case the docstring above warns about: logged so it doesn't go unnoticed.
    if (workspaces.length > 0) {
      logger.warn(
        { workspaceNames: workspaces.map((w) => w.name) },
        '[VoicenoteSkill] No workspace named "Personal Workspace" — falling back to the first one. See resolvePersonalWorkspaceId docstring.',
      )
    }
    return workspaces[0]?.id
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
export { buildSummaryMessage, buildBrandKeyboard, buildWorkspaceKeyboard, buildIntentKeyboard, escapeMarkdown }
export type { Brand, Workspace }

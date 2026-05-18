import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { ConfigService } from '@nestjs/config'
import { getClientForFeature } from '@nau/llm-client'
import { transcribeAudio } from '../../services/transcription.service'
import { signServiceToken } from '@nau/auth'
import axios from 'axios'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { z } from 'zod'

const VoiceProcessOutputSchema = z.object({
  cleanTranscription: z.string(),
  synthesis: z.string(),
})

@Injectable()
export class VoicenoteService implements OnModuleInit {
  private readonly logger = new Logger(VoicenoteService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    // Delay flush so downstream services (flownau) have time to become ready after a simultaneous deploy
    setTimeout(() => {
      this.flushPendingConcepts().catch((err) =>
        this.logger.error('[VoicenoteService] Startup flush failed', err),
      )
    }, 30_000)
  }

  async processAudio(audioUrl: string, brandId?: string): Promise<{ rawTranscription: string; cleanTranscription: string; synthesis: string }> {
    const language = brandId
      ? ((await this.prisma.brand.findUnique({ where: { id: brandId }, select: { language: true } }))?.language ?? 'Spanish')
      : 'Spanish'
    const tmpPath = path.join(os.tmpdir(), `nau-voice-${Date.now()}.ogg`)

    try {
      const resp = await axios.get(audioUrl, { responseType: 'arraybuffer', timeout: 30_000 })
      fs.writeFileSync(tmpPath, Buffer.from(resp.data))

      const { text: rawTranscription } = await transcribeAudio(tmpPath)

      const { client, model } = getClientForFeature('synthesis')
      const result = await client.chatCompletion({
        model,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content: `You receive a raw voice transcription from a content creator. Return JSON with two fields:
- "cleanTranscription": the transcription cleaned of filler words, repeated phrases, and disfluencies, with proper punctuation. Keep all meaning intact.
- "synthesis": a 2–4 sentence interpretation of the core idea, intent, and key themes the creator expressed. Write it as a rich content angle that an ideation LLM can work from.

Write all output in ${language}.

Return only valid JSON: { "cleanTranscription": "...", "synthesis": "..." }`,
          },
          { role: 'user', content: rawTranscription },
        ],
        responseFormat: { type: 'json_object' },
      })

      const parsed = VoiceProcessOutputSchema.parse(JSON.parse(result.content))
      return { rawTranscription, ...parsed }
    } finally {
      fs.rmSync(tmpPath, { force: true })
    }
  }

  async listForBrand(brandId: string) {
    return this.prisma.voicenote.findMany({
      where: { brandId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  }

  async getOne(id: string) {
    const voicenote = await this.prisma.voicenote.findUnique({ where: { id } })
    if (!voicenote) return null
    const conceptSources = await this.prisma.sourceConceptSource.findMany({
      where: { voicenoteId: id },
      include: { sourceConcept: true },
    })
    const concepts = conceptSources.map((s) => s.sourceConcept).filter(Boolean)
    return { voicenote, concepts }
  }

  async createFromCapture(
    brandId: string,
    data: { cleanTranscription: string; synthesis: string; sourceRef?: string },
  ) {
    const brand = await this.prisma.brand.upsert({
      where: { id: brandId },
      create: { id: brandId, workspaceId: '' },
      update: {},
      select: { language: true },
    })

    // Re-synthesize using the brand's language so the SourceConcept is always
    // in the correct language regardless of what language zazu processed with.
    const language = brand.language ?? 'Spanish'
    let synthesis = data.synthesis
    try {
      const { client, model } = getClientForFeature('synthesis')
      const result = await client.chatCompletion({
        model,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content: `You receive a content creator's transcription. Write a 2–4 sentence interpretation of the core idea, intent, and key themes as a rich content angle that an ideation LLM can work from. Write all output in ${language}.`,
          },
          { role: 'user', content: data.cleanTranscription },
        ],
      })
      synthesis = result.content?.trim() || data.synthesis
    } catch {
      // Non-critical — fall back to the synthesis received from zazu
    }

    const voicenote = await this.prisma.voicenote.create({
      data: {
        brandId,
        cleanTranscription: data.cleanTranscription,
        synthesis,
        sourceRef: data.sourceRef ?? null,
      },
    })

    const concept = await this.prisma.sourceConcept.create({
      data: {
        brandId,
        content: synthesis,
        sourceType: 'voicenote',
        status: 'pending',
      },
    })
    await this.prisma.sourceConceptSource.create({
      data: { sourceConceptId: concept.id, voicenoteId: voicenote.id },
    })

    const ideaCount = await this.pushConceptToFlownau(brandId, concept.id, concept.content)
    if (ideaCount === null) {
      this.logger.warn({ brandId, conceptId: concept.id }, '[VoicenoteService] Push to flownau failed — concept stays pending for recovery flush')
    }

    return { voicenote, concept, ideaCount: ideaCount ?? 0 }
  }

  // Flush all pending voicenote SourceConcepts that were never delivered to flownau.
  // Called on startup and can be triggered manually.
  async flushPendingConcepts(): Promise<void> {
    const pending = await this.prisma.sourceConcept.findMany({
      where: { sourceType: 'voicenote', status: 'pending' },
    })
    if (pending.length === 0) return

    this.logger.log(`[VoicenoteService] Flushing ${pending.length} pending voicenote concept(s)`)

    for (const concept of pending) {
      const pushed = await this.pushConceptToFlownau(concept.brandId, concept.id, concept.content)
      if (pushed === null) {
        this.logger.warn({ conceptId: concept.id, brandId: concept.brandId }, '[VoicenoteService] Flush: push still failing')
      }
    }
  }

  private async pushConceptToFlownau(brandId: string, conceptId: string, topic: string): Promise<number | null> {
    const flownauUrl = this.config.get<string>('FLOWNAU_URL')
    const authSecret = this.config.get<string>('AUTH_SECRET')
    if (!flownauUrl || !authSecret) {
      this.logger.error('[VoicenoteService] FLOWNAU_URL or AUTH_SECRET not set — cannot push concept')
      return null
    }

    try {
      const token = await signServiceToken({ secret: authSecret, iss: 'nauthenticity', aud: 'flownau' })
      const res = await axios.post<{ ideas: unknown[] }>(
        `${flownauUrl}/api/v1/service/ideation`,
        { brandId, topic, sourceRef: conceptId },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 120_000 },
      )
      await this.prisma.sourceConcept.update({
        where: { id: conceptId },
        data: { status: 'consumed', consumedAt: new Date() },
      })
      this.logger.log({ brandId, conceptId }, '[VoicenoteService] Concept pushed to flownau and ideation triggered')
      return Array.isArray(res.data?.ideas) ? res.data.ideas.length : 0
    } catch (err) {
      this.logger.error({ brandId, conceptId, err }, '[VoicenoteService] Failed to push concept to flownau')
      return null
    }
  }
}

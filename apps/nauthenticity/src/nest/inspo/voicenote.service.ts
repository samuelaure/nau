import { Injectable, NotFoundException } from '@nestjs/common'
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
export class VoicenoteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async processAudio(audioUrl: string): Promise<{ rawTranscription: string; cleanTranscription: string; synthesis: string }> {
    const tmpPath = path.join(os.tmpdir(), `nau-voice-${Date.now()}.ogg`)

    try {
      // Download audio file from CDN URL
      const resp = await axios.get(audioUrl, { responseType: 'arraybuffer', timeout: 30_000 })
      fs.writeFileSync(tmpPath, Buffer.from(resp.data))

      // Transcribe via Whisper
      const { text: rawTranscription } = await transcribeAudio(tmpPath)

      // Clean and synthesize via LLM
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

  async createFromCapture(
    brandId: string,
    data: { cleanTranscription: string; synthesis: string; sourceRef?: string },
  ) {
    const brand = await this.prisma.brand.findUnique({ where: { id: brandId } })
    if (!brand) throw new NotFoundException('Brand not found')

    // Store voicenote
    const voicenote = await this.prisma.voicenote.create({
      data: {
        brandId,
        cleanTranscription: data.cleanTranscription,
        synthesis: data.synthesis,
        sourceRef: data.sourceRef ?? null,
      },
    })

    // Create a single SourceConcept from the synthesis
    const concept = await this.prisma.sourceConcept.create({
      data: {
        brandId,
        content: data.synthesis,
        sourceType: 'voicenote',
        status: 'pending',
      },
    })

    // Push immediately to flownau — if it fails, concept stays pending for coverage service
    await this.pushConceptToFlownau(brandId, concept.id, concept.content)

    return { voicenote, concept }
  }

  private async pushConceptToFlownau(brandId: string, conceptId: string, topic: string): Promise<void> {
    const flownauUrl = this.config.get<string>('FLOWNAU_URL')
    const authSecret = this.config.get<string>('AUTH_SECRET')
    if (!flownauUrl || !authSecret) return

    try {
      const token = await signServiceToken({ secret: authSecret, iss: 'nauthenticity', aud: 'flownau' })
      await axios.post(
        `${flownauUrl}/api/v1/_service/ideation`,
        { brandId, topic, sourceRef: conceptId },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 120_000 },
      )
      await this.prisma.sourceConcept.update({
        where: { id: conceptId },
        data: { status: 'consumed', consumedAt: new Date() },
      })
    } catch {
      // Stays pending — coverage service will pick it up on next trigger
    }
  }
}

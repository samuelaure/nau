import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { getClientForFeature, reportUsage } from '@nau/llm-client'
import { ConfigService } from '@nestjs/config'
import { z } from 'zod'

const SourceConceptsOutputSchema = z.object({
  concepts: z.array(z.object({ content: z.string() })),
})

@Injectable()
export class SourceConceptService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async generateFromInspoBase(brandId: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { id: brandId },
      include: { ownedProfiles: { select: { id: true } } },
    })
    if (!brand) throw new NotFoundException('Brand not found')

    const memberships = await this.prisma.categoryMembership.findMany({
      where: { brandId, category: 'INSPO', isActive: true },
      include: {
        post: { select: { url: true, caption: true } },
        socialProfile: { select: { username: true } },
      },
    })

    if (memberships.length === 0) {
      throw new UnprocessableEntityException('InspoBase is empty — add posts or profiles first.')
    }

    const inspoLines: string[] = []
    for (const m of memberships) {
      if (m.post?.caption) inspoLines.push(`Caption: ${m.post.caption.slice(0, 600)}`)
      else if (m.socialProfile) inspoLines.push(`Profile: @${m.socialProfile.username}`)
    }

    const ownedSynthesis = await this.prisma.brandSynthesis.findFirst({
      where: { brandId, type: 'owned_content' },
      orderBy: { createdAt: 'desc' },
      select: { content: true },
    })

    const systemPrompt = `You are a creative content strategist. You receive a brand's InspoBase — a curated collection of inspiring posts and profiles — and you extract distinct, actionable source concepts from it as a whole.

A source concept is a rich, self-contained angle or topic that can drive a separate batch of content ideas. Each concept must be distinct: no overlap, no repetition.

Generate as many source concepts as genuinely capture distinct angles from this InspoBase — be moderate, quality over quantity.

Return JSON: { "concepts": [ { "content": "..." }, ... ] }
Each "content" is a paragraph (30–60 words) describing the concept clearly enough for an ideation LLM to work from it independently.`

    const inspoBlock = inspoLines.join('\n')
    const voiceBlock = brand.voicePrompt ? `\n\n## BRAND VOICE\n${brand.voicePrompt.slice(0, 500)}` : ''
    const ownedBlock = ownedSynthesis ? `\n\n## OWNED CONTENT SYNTHESIS\n${ownedSynthesis.content.slice(0, 400)}` : ''

    const userMessage = `## INSPOBASE\n${inspoBlock}${voiceBlock}${ownedBlock}\n\nExtract source concepts.`

    const { client, model } = getClientForFeature('synthesis')
    const result = await client.chatCompletion({
      model,
      temperature: 0.8,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      responseFormat: { type: 'json_object' },
    })

    const apiURL = this.config.get<string>('NAU_API_URL')
    const authSecret = this.config.get<string>('AUTH_SECRET')
    if (apiURL && authSecret) {
      const { signServiceToken } = await import('@nau/auth')
      signServiceToken({ secret: authSecret, iss: 'nauthenticity', aud: 'api' })
        .then((token) => {
          reportUsage({
            apiUrl: apiURL,
            serviceToken: token,
            workspaceId: brand.workspaceId || '',
            brandId,
            service: 'nauthenticity',
            operation: 'chat_completion',
            usage: result.usage,
          })
        })
        .catch(() => {})
    }

    const parsed = SourceConceptsOutputSchema.parse(JSON.parse(result.content))

    const created = await Promise.all(
      parsed.concepts.map((c) =>
        this.prisma.sourceConcept.create({
          data: { brandId, content: c.content, sourceType: 'inspo_base', status: 'pending' },
        }),
      ),
    )

    return created
  }

  async listPending(brandId: string) {
    return this.prisma.sourceConcept.findMany({
      where: { brandId, status: 'pending' },
      orderBy: { createdAt: 'asc' },
    })
  }

  async markConsumed(id: string) {
    const concept = await this.prisma.sourceConcept.findUnique({ where: { id } })
    if (!concept) throw new NotFoundException('SourceConcept not found')
    return this.prisma.sourceConcept.update({
      where: { id },
      data: { status: 'consumed', consumedAt: new Date() },
    })
  }
}

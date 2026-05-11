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

    // Fetch INSPO post memberships — use postSynthesis (rich interpretation) when available,
    // fall back to caption slice. Profile-only memberships contribute a username line.
    // Select recent posts first; this is the "recent" selection strategy.
    // Future variants: random, topic-based.
    const memberships = await this.prisma.categoryMembership.findMany({
      where: { brandId, category: 'INSPO', isActive: true, postId: { not: null } },
      include: {
        post: { select: { postSynthesis: true, caption: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 60,
    })

    const profileMemberships = await this.prisma.categoryMembership.findMany({
      where: { brandId, category: 'INSPO', isActive: true, socialProfileId: { not: null } },
      include: { socialProfile: { select: { username: true } } },
      take: 20,
    })

    const totalItems = memberships.length + profileMemberships.length
    if (totalItems === 0) {
      throw new UnprocessableEntityException('InspoBase is empty — add posts or profiles first.')
    }

    const inspoLines: string[] = []
    for (const m of memberships) {
      if (!m.post) continue
      const text = m.post.postSynthesis ?? m.post.caption?.slice(0, 400)
      if (text) inspoLines.push(text)
    }
    for (const m of profileMemberships) {
      if (m.socialProfile) inspoLines.push(`Profile: @${m.socialProfile.username}`)
    }

    const systemPrompt = `You are a creative content strategist. You receive a brand's InspoBase — a curated collection of inspiring posts and profiles — and you extract distinct, actionable source concepts from it as a whole.

A source concept is a rich, self-contained angle or topic that can drive a separate batch of content ideas. Each concept must be distinct: no overlap, no repetition.

Generate as many source concepts as genuinely capture distinct angles from this InspoBase — be moderate, quality over quantity.

Return JSON: { "concepts": [ { "content": "..." }, ... ] }
Each "content" is a paragraph (30–60 words) describing the concept clearly enough for an ideation LLM to work from it independently.`

    const userMessage = `## INSPOBASE\n${inspoLines.join('\n\n')}\n\nExtract source concepts.`

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

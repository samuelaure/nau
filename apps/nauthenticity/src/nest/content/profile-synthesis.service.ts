import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { ConfigService } from '@nestjs/config'
import { getClientForFeature, reportUsage } from '@nau/llm-client'
import { z } from 'zod'

const IntelligenceOutputSchema = z.object({
  synthesis: z.string(),
  concepts: z.array(z.object({ content: z.string() })),
})

@Injectable()
export class ProfileSynthesisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async generateForProfile(socialProfileId: string) {
    const profile = await this.prisma.socialProfile.findUnique({
      where: { id: socialProfileId },
      select: {
        id: true,
        username: true,
        _count: { select: { posts: { where: { postSynthesis: { not: null } } } } },
      },
    })
    if (!profile) throw new NotFoundException('SocialProfile not found')

    const posts = await this.prisma.post.findMany({
      where: { socialProfileId, postSynthesis: { not: null } },
      select: { postSynthesis: true },
      orderBy: { postedAt: 'desc' },
      take: 30,
    })

    if (posts.length === 0) {
      throw new BadRequestException('No synthesized posts available for this profile yet.')
    }

    const synthesisList = posts
      .map((p, i) => `${i + 1}. ${p.postSynthesis}`)
      .join('\n')

    const systemPrompt = `You extract reusable content intelligence from a set of post summaries. Your output will be used by other content teams as inspiration — it must be completely detached from the original author.

Write a dense paragraph that captures the recurring ideas, arguments, perspectives, and content angles present across the posts. Focus entirely on the IDEAS: what topics are explored, what positions are taken, what tensions are surfaced, what frames and metaphors recur.

Rules:
- Never mention the author, their name, their account, or anything that identifies them
- Exclude all commercial content: offers, pricing, services, products, CTAs, promotions
- Do not describe the content — express the ideas directly
- No meta-language ("these posts explore", "the author argues") — state the ideas themselves
- Write in continuous prose, concrete and specific`

    const userMessage = `## Post Summaries (${posts.length} posts)\n${synthesisList}\n\nWrite the idea synthesis.`

    const { client, model } = getClientForFeature('synthesis')
    const result = await client.chatCompletion({
      model,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    })

    const content = result.content.trim()
    const postCountAtGeneration = posts.length

    // Archive existing synthesis before overwriting
    const existing = await this.prisma.profileSynthesis.findUnique({
      where: { socialProfileId },
    })
    if (existing) {
      await this.prisma.profileSynthesisHistory.create({
        data: {
          socialProfileId,
          content: existing.content,
          postCountAtGeneration: existing.postCountAtGeneration,
          generatedAt: existing.generatedAt,
        },
      })
    }

    const synthesis = await this.prisma.profileSynthesis.upsert({
      where: { socialProfileId },
      create: { socialProfileId, content, postCountAtGeneration },
      update: { content, postCountAtGeneration, generatedAt: new Date() },
    })

    const apiURL = this.config.get<string>('NAU_API_URL')
    const authSecret = this.config.get<string>('AUTH_SECRET')
    if (apiURL && authSecret) {
      const { signServiceToken } = await import('@nau/auth')
      signServiceToken({ secret: authSecret, iss: 'nauthenticity', aud: 'api' })
        .then((token) =>
          reportUsage({
            apiUrl: apiURL,
            serviceToken: token,
            workspaceId: '',
            brandId: socialProfileId,
            service: 'nauthenticity',
            operation: 'chat_completion',
            usage: result.usage,
          }),
        )
        .catch(() => {})
    }

    return synthesis
  }

  async generateIntelligence(socialProfileId: string, brandId: string) {
    const [profile, brand] = await Promise.all([
      this.prisma.socialProfile.findUnique({
        where: { id: socialProfileId },
        select: { id: true, username: true },
      }),
      this.prisma.brand.findUnique({ where: { id: brandId }, select: { id: true, language: true } }),
    ])
    if (!profile) throw new NotFoundException('SocialProfile not found')
    if (!brand) throw new NotFoundException('Brand not found')

    const posts = await this.prisma.post.findMany({
      where: { socialProfileId, postSynthesis: { not: null } },
      select: { postSynthesis: true, caption: true },
      orderBy: { postedAt: 'desc' },
      take: 30,
    })

    if (posts.length === 0) {
      throw new BadRequestException('No synthesized posts available for this profile yet.')
    }

    const postLines = posts
      .map((p, i) => `${i + 1}. ${p.postSynthesis ?? p.caption}`)
      .join('\n')

    const language = brand.language ?? 'Spanish'

    const systemPrompt = `You extract reusable content intelligence from a set of post summaries. Your output will be used by other content teams as inspiration material — it must be completely detached from the original author.

Produce two outputs:

1. "synthesis" — a dense paragraph capturing the recurring ideas, arguments, perspectives, and content angles present across the posts. Focus entirely on the IDEAS: what topics are explored, what positions are taken, what tensions are surfaced, what frames and metaphors recur. Never mention the author, their name, their identity, or anything that identifies them. Exclude all commercial content: offers, pricing, services, products, CTAs. Do not describe the content — express the ideas directly. No meta-language. Concrete and specific.

2. "concepts" — an array of distinct content angles (30-60 words each) that any brand could use as a starting point for their own content, derived from the ideas above. Each concept must be self-contained and independent of the original author or their business. A good concept poses a clear argument, tension, or perspective that could inspire original content. Exclude anything tied to personal branding, offers, or promotion. Quality over quantity — only include concepts strong enough to independently drive an ideation batch.

Write all output in ${language}.

Return JSON: { "synthesis": "...", "concepts": [{ "content": "..." }, ...] }`

    const userMessage = `## Post Summaries (${posts.length} posts)\n${postLines}\n\nGenerate idea synthesis and source concepts.`

    const { client, model } = getClientForFeature('synthesis')
    const result = await client.chatCompletion({
      model,
      temperature: 0.4,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      responseFormat: { type: 'json_object' },
    })

    const parsed = IntelligenceOutputSchema.parse(JSON.parse(result.content))

    // Archive and save synthesis
    const existing = await this.prisma.profileSynthesis.findUnique({ where: { socialProfileId } })
    if (existing) {
      await this.prisma.profileSynthesisHistory.create({
        data: {
          socialProfileId,
          content: existing.content,
          postCountAtGeneration: existing.postCountAtGeneration,
          generatedAt: existing.generatedAt,
        },
      })
    }
    const synthesis = await this.prisma.profileSynthesis.upsert({
      where: { socialProfileId },
      create: { socialProfileId, content: parsed.synthesis, postCountAtGeneration: posts.length },
      update: { content: parsed.synthesis, postCountAtGeneration: posts.length, generatedAt: new Date() },
    })

    // Save synthesis as the primary source concept, then save derived concepts
    const synthesisConcept = await this.prisma.sourceConcept.create({
      data: { brandId, content: parsed.synthesis, sourceType: 'synthesis', status: 'pending' },
    })
    await this.prisma.sourceConceptSource.create({
      data: { sourceConceptId: synthesisConcept.id, socialProfileId },
    })

    await Promise.all(
      parsed.concepts.map(async (c) => {
        const concept = await this.prisma.sourceConcept.create({
          data: { brandId, content: c.content, sourceType: 'inspo_base', status: 'pending' },
        })
        await this.prisma.sourceConceptSource.create({
          data: { sourceConceptId: concept.id, socialProfileId },
        })
      }),
    )

    void this.reportLLMUsage(result, brandId)

    return { synthesis, conceptCount: parsed.concepts.length }
  }

  private reportLLMUsage(result: Awaited<ReturnType<ReturnType<typeof getClientForFeature>['client']['chatCompletion']>>, brandId: string) {
    const apiURL = this.config.get<string>('NAU_API_URL')
    const authSecret = this.config.get<string>('AUTH_SECRET')
    if (!apiURL || !authSecret) return
    import('@nau/auth').then(({ signServiceToken }) =>
      signServiceToken({ secret: authSecret, iss: 'nauthenticity', aud: 'api' })
        .then((token) =>
          reportUsage({
            apiUrl: apiURL,
            serviceToken: token,
            workspaceId: '',
            brandId,
            service: 'nauthenticity',
            operation: 'chat_completion',
            usage: result.usage,
          }),
        )
        .catch(() => {}),
    ).catch(() => {})
  }

  async checkAndSoftUpdate(socialProfileId: string): Promise<void> {
    const [existing, profile] = await Promise.all([
      this.prisma.profileSynthesis.findUnique({ where: { socialProfileId } }),
      this.prisma.socialProfile.findUnique({
        where: { id: socialProfileId },
        select: {
          synthesisTriggerThreshold: true,
          _count: { select: { posts: { where: { postSynthesis: { not: null } } } } },
        },
      }),
    ])

    if (!profile) return
    if (!existing) {
      // No synthesis yet — generate if we have at least threshold posts
      if (profile._count.posts >= profile.synthesisTriggerThreshold) {
        await this.generateForProfile(socialProfileId)
      }
      return
    }

    const newPostsSince = profile._count.posts - existing.postCountAtGeneration
    if (newPostsSince >= profile.synthesisTriggerThreshold) {
      await this.generateForProfile(socialProfileId)
    }
  }

  async getSynthesis(socialProfileId: string) {
    const [synthesis, history] = await Promise.all([
      this.prisma.profileSynthesis.findUnique({ where: { socialProfileId } }),
      this.prisma.profileSynthesisHistory.findMany({
        where: { socialProfileId },
        orderBy: { archivedAt: 'desc' },
        take: 5,
      }),
    ])
    return { synthesis, history }
  }

  async updateThreshold(socialProfileId: string, threshold: number) {
    if (threshold < 36) throw new BadRequestException('Threshold must be at least 36')
    const profile = await this.prisma.socialProfile.findUnique({ where: { id: socialProfileId } })
    if (!profile) throw new NotFoundException('SocialProfile not found')
    return this.prisma.socialProfile.update({
      where: { id: socialProfileId },
      data: { synthesisTriggerThreshold: threshold },
      select: { id: true, username: true, synthesisTriggerThreshold: true },
    })
  }
}

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

    const systemPrompt = `You are a content distiller. You receive condensed summaries of posts from a single social media profile. Write a holistic profile synthesis that reads like a direct representation of this creator's voice and worldview — not an analysis of it.

Capture: the recurring ideas and arguments they make, the specific language and framing they use, their point of view, and what they consistently stand for or against.

Write in continuous prose, in the same register as the content itself. Be concrete and specific — no generic observations. No meta-language like "este perfil aborda" or "el creador habla de".`

    const userMessage = `## Profile: @${profile.username}\n\n## Post Syntheses (${posts.length} posts)\n${synthesisList}\n\nWrite the profile synthesis.`

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

    const systemPrompt = `You are a content distiller. You receive condensed summaries of up to 30 posts from a single social media profile. Produce two outputs in one JSON response:

1. "synthesis" — a holistic profile synthesis that reads like a direct representation of this creator's voice and worldview, not an analysis of it. Capture: the recurring ideas and arguments they make, the specific language and framing they use, their point of view, what they consistently stand for or against. Write in continuous prose, in the same register as the content. No meta-language like "este perfil aborda" or "el creador habla de". Be concrete and specific.

2. "concepts" — an array of distinct, actionable source concepts (each 30-60 words) derived from the profile's actual ideas. Each concept must be self-contained and rich enough to drive an independent ideation batch. Quality over quantity.

Write all text in ${language}.

Return JSON: { "synthesis": "...", "concepts": [{ "content": "..." }, ...] }`

    const userMessage = `## Profile: @${profile.username}\n\n## Post Syntheses (${posts.length} posts)\n${postLines}\n\nGenerate synthesis and source concepts.`

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

    // Save source concepts linked to this profile
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

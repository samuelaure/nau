import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { ConfigService } from '@nestjs/config'
import { getClientForFeature, reportUsage } from '@nau/llm-client'

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
    })

    if (posts.length === 0) {
      throw new BadRequestException('No synthesized posts available for this profile yet.')
    }

    const synthesisList = posts
      .map((p, i) => `${i + 1}. ${p.postSynthesis}`)
      .join('\n')

    const systemPrompt = `You are a brand intelligence analyst. You receive a numbered list of individual post syntheses from a single social media profile. Your task is to write a holistic profile synthesis — a clear, objective portrait of this profile covering:
- Recurring topics and themes
- Tone and communication style
- Content formats and angles used
- Distinctive qualities and positioning

Write in continuous prose. No fixed length — use as many paragraphs as needed to represent the profile faithfully. Be specific and evidence-based.`

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

import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { getClientForFeature } from '@nau/llm-client'
import { PrismaService } from '../prisma/prisma.service'
import { GenerateCommentDto, CommentFeedbackDto } from './benchmark.dto'

const DEFAULT_VOICE = `You are an authentic, engaging brand on social media. Write comments that are genuine, add value to the conversation, and reflect a professional yet approachable personality. Be concise, positive, and relevant to the post's content.`

@Injectable()
export class BenchmarkService {
  private readonly logger = new Logger(BenchmarkService.name)
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async generateComments(brandId: string, dto: GenerateCommentDto): Promise<{ suggestions: string[] }> {
    const synthesis = await this.prisma.brandSynthesis.findFirst({
      where: { brandId, type: 'voice' },
    })
    const voicePrompt = synthesis?.content ?? DEFAULT_VOICE

    const parts = [
      `Brand voice: ${voicePrompt}`,
      `Target post URL: ${dto.postUrl}`,
      dto.postCaption ? `Caption: ${dto.postCaption}` : null,
      dto.postTranscript ? `Transcript: ${dto.postTranscript}` : null,
      'Generate 3 distinct comment suggestions. Return JSON: { "comments": ["...", "...", "..."] }',
    ].filter(Boolean)

    const { client, model } = getClientForFeature('benchmark')
    const result = await client.chatCompletion({
      model,
      messages: [{ role: 'user', content: parts.join('\n\n') }],
      responseFormat: { type: 'json_object' },
      maxTokens: 400,
    })

    const parsed = JSON.parse(result.content) as { comments?: string[] }
    const suggestions = parsed.comments ?? []

    this.logger.log(`Generated ${suggestions.length} comments for brand ${brandId}`)
    return { suggestions }
  }

  async saveFeedback(brandId: string, dto: CommentFeedbackDto) {
    const post = await this.prisma.post.findUnique({ where: { id: dto.postId } })
    if (!post) {
      // Create a placeholder post record if not scraped yet
      return this.prisma.commentFeedback.create({
        data: {
          brandId,
          postId: dto.postId,
          commentText: dto.commentText,
          isSelected: dto.isSelected ?? false,
        },
      })
    }
    return this.prisma.commentFeedback.create({
      data: {
        brandId,
        postId: dto.postId,
        commentText: dto.commentText,
        isSelected: dto.isSelected ?? false,
      },
    })
  }

  async listFeedback(brandId: string) {
    return this.prisma.commentFeedback.findMany({
      where: { brandId },
      orderBy: { sentAt: 'desc' },
      take: 100,
    })
  }

  async getSynthesis(brandId: string, type: string) {
    return this.prisma.brandSynthesis.findFirst({ where: { brandId, type } })
  }

  async listSyntheses(brandId: string) {
    return this.prisma.brandSynthesis.findMany({ where: { brandId } })
  }

  async upsertSynthesis(brandId: string, type: string, content: string, attachedUrls: string[] = []) {
    const existing = await this.prisma.brandSynthesis.findFirst({ where: { brandId, type } })
    if (existing) {
      return this.prisma.brandSynthesis.update({
        where: { id: existing.id },
        data: { content, attachedUrls },
      })
    }
    return this.prisma.brandSynthesis.create({
      data: { brandId, type, content, attachedUrls },
    })
  }
}

import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { runProactiveFanout } from '../../modules/proactive/fanout.processor'
import { generateReactiveComments } from '../../modules/proactive/reactive.service'

@Injectable()
export class IntelligenceService {
  constructor(private readonly prisma: PrismaService) {}

  async getIntelligence(brandId: string) {
    const intelligence = await this.prisma.brandIntelligence.findUnique({
      where: { brandId },
      include: {
        targets: {
          select: {
            id: true,
            socialProfile: { select: { username: true } },
            targetType: true,
            isActive: true,
            profileStrategy: true,
            initialDownloadCount: true,
            autoUpdate: true,
            createdAt: true,
          },
        },
      },
    })
    if (!intelligence) throw new NotFoundException('Brand intelligence not found')
    return intelligence
  }

  async upsertIntelligence(brandId: string, data: Record<string, unknown>) {
    const allowed = ['workspaceId', 'mainUsername', 'voicePrompt', 'commentStrategy', 'suggestionsCount', 'windowStart', 'windowEnd', 'timezone']
    const patch: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in data) patch[key] = data[key]
    }
    return this.prisma.brandIntelligence.upsert({
      where: { brandId },
      create: {
        brandId,
        workspaceId: (patch.workspaceId as string) ?? '',
        voicePrompt: (patch.voicePrompt as string) ?? '',
        ...patch,
      },
      update: patch,
    })
  }

  async getDna(brandId: string) {
    const intelligence = await this.prisma.brandIntelligence.findUnique({
      where: { brandId },
      include: {
        targets: { select: { socialProfile: { select: { username: true } }, profileStrategy: true } },
        syntheses: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    })
    if (!intelligence) throw new NotFoundException('Brand intelligence not found')
    return {
      brandId: intelligence.brandId,
      voicePrompt: intelligence.voicePrompt,
      commentStrategy: intelligence.commentStrategy,
      suggestionsCount: intelligence.suggestionsCount,
      targets: intelligence.targets,
      latestSynthesis: (intelligence as unknown as { syntheses: unknown[] }).syntheses[0] ?? null,
    }
  }

  async getDnaLight(brandId: string) {
    const intelligence = await this.prisma.brandIntelligence.findUnique({
      where: { brandId },
      select: { brandId: true, voicePrompt: true },
    })
    if (!intelligence) throw new NotFoundException('Brand intelligence not found')
    return { brandId: intelligence.brandId, voicePrompt: intelligence.voicePrompt.slice(0, 500) }
  }

  async listServiceBrands(workspaceId: string) {
    return this.prisma.brandIntelligence.findMany({
      where: { workspaceId },
      include: {
        targets: { select: { socialProfile: { select: { username: true } }, profileStrategy: true, targetType: true } },
      },
    })
  }

  async syncServiceBrand(brandId: string, data: { workspaceId?: string; mainUsername?: string }) {
    return this.prisma.brandIntelligence.update({ where: { brandId }, data })
  }

  async createTargets(
    brandId: string,
    usernames: string[],
    opts: {
      targetType?: string
      profileStrategy?: string | null
      isActive?: boolean
      initialDownloadCount?: number | null
      autoUpdate?: boolean | null
    },
  ) {
    for (const username of usernames) {
      const profile = await this.prisma.socialProfile.upsert({
        where: { platform_username: { platform: 'instagram', username } },
        create: { platform: 'instagram', username },
        update: {},
      })
      await this.prisma.socialProfileTarget.upsert({
        where: { brandId_socialProfileId: { brandId, socialProfileId: profile.id } },
        create: {
          brandId,
          socialProfileId: profile.id,
          targetType: opts.targetType ?? 'monitored',
          profileStrategy: opts.profileStrategy ?? null,
          isActive: opts.isActive ?? true,
          initialDownloadCount: opts.initialDownloadCount ?? null,
          autoUpdate: opts.autoUpdate ?? null,
        },
        update: {
          targetType: opts.targetType,
          profileStrategy: opts.profileStrategy !== undefined ? opts.profileStrategy : undefined,
          isActive: opts.isActive,
          initialDownloadCount: opts.initialDownloadCount !== undefined ? opts.initialDownloadCount : undefined,
          autoUpdate: opts.autoUpdate !== undefined ? opts.autoUpdate : undefined,
        },
      })
    }
    return { success: true }
  }

  async updateTarget(id: string, data: Record<string, unknown>) {
    return this.prisma.socialProfileTarget.update({ where: { id }, data })
  }

  async deleteTarget(id: string) {
    await this.prisma.socialProfileTarget.delete({ where: { id } })
    return { success: true }
  }

  async generateComment(targetUrl: string, brandId: string) {
    const intelligence = await this.prisma.brandIntelligence.findUnique({ where: { brandId } })
    if (!intelligence) throw new NotFoundException('Brand intelligence not found')
    const suggestions = await generateReactiveComments(targetUrl, brandId)
    return { success: true, suggestions }
  }

  async commentFeedback(brandId: string, sourcePostId: string, commentText: string, isSelected: boolean) {
    await this.prisma.commentFeedback.create({
      data: { brandId, postId: sourcePostId, commentText, isSelected },
    })
    return { success: true }
  }

  triggerFanout() {
    runProactiveFanout().catch(() => {})
    return { success: true, message: 'Fanout initiated in background.' }
  }

  async getTargets(brandId: string, targetType?: string) {
    return this.prisma.socialProfileTarget.findMany({
      where: { brandId, targetType: targetType ?? undefined },
      include: {
        socialProfile: { include: { _count: { select: { posts: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async patchTarget(id: string, data: { isActive?: boolean; autoUpdate?: boolean; initialDownloadCount?: number }) {
    const patch: Record<string, unknown> = {}
    if (data.isActive !== undefined) patch.isActive = data.isActive
    if (data.autoUpdate !== undefined) patch.autoUpdate = data.autoUpdate
    if (data.initialDownloadCount !== undefined) patch.initialDownloadCount = data.initialDownloadCount
    return this.prisma.socialProfileTarget.update({ where: { id }, data: patch })
  }
}

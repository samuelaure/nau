import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { runProactiveFanout } from '../../modules/proactive/fanout.processor'
import { generateReactiveComments } from '../../modules/proactive/reactive.service'

@Injectable()
export class IntelligenceService {
  constructor(private readonly prisma: PrismaService) {}

  async getIntelligence(brandId: string) {
    const intelligence = await this.prisma.brand.findUnique({
      where: { id: brandId },
      include: {
        monitors: {
          select: {
            id: true,
            socialProfile: { select: { username: true } },
            monitoringType: true,
            isActive: true,
            settings: true,
            createdAt: true,
          },
        },
      },
    })
    return intelligence ?? null
  }

  async upsertIntelligence(brandId: string, data: Record<string, unknown>) {
    const allowed = ['workspaceId', 'mainUsername', 'voicePrompt', 'commentStrategy', 'suggestionsCount', 'windowStart', 'windowEnd', 'timezone']
    const patch: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in data) patch[key] = data[key]
    }
    return this.prisma.brand.upsert({
      where: { id: brandId },
      create: {
        id: brandId,
        workspaceId: (patch.workspaceId as string) ?? '',
        voicePrompt: (patch.voicePrompt as string) ?? '',
        ...patch,
      },
      update: patch,
    })
  }

  async getDna(brandId: string) {
    const intelligence = await this.prisma.brand.findUnique({
      where: { id: brandId },
      include: {
        monitors: { select: { socialProfile: { select: { username: true } }, settings: true } },
        syntheses: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    })
    if (!intelligence) throw new NotFoundException('Brand intelligence not found')
    return {
      brandId: intelligence.id,
      voicePrompt: intelligence.voicePrompt,
      commentStrategy: intelligence.commentStrategy,
      suggestionsCount: intelligence.suggestionsCount,
      targets: intelligence.monitors,
      latestSynthesis: (intelligence as unknown as { syntheses: unknown[] }).syntheses[0] ?? null,
    }
  }

  async getDnaLight(brandId: string) {
    const intelligence = await this.prisma.brand.findUnique({
      where: { id: brandId },
      select: { id: true, voicePrompt: true },
    })
    if (!intelligence) throw new NotFoundException('Brand intelligence not found')
    return { brandId: intelligence.id, voicePrompt: intelligence.voicePrompt.slice(0, 500) }
  }

  async listServiceBrands(workspaceId: string) {
    return this.prisma.brand.findMany({
      where: { workspaceId },
      include: {
        monitors: { select: { socialProfile: { select: { username: true } }, settings: true, monitoringType: true } },
      },
    })
  }

  async syncServiceBrand(brandId: string, data: { workspaceId?: string; mainUsername?: string }) {
    return this.prisma.brand.update({ where: { id: brandId }, data })
  }

  async createTargets(
    brandId: string,
    usernames: string[],
    opts: {
      monitoringType?: string
      settings?: Record<string, unknown>
      isActive?: boolean
    },
  ) {
    for (const username of usernames) {
      const profile = await this.prisma.socialProfile.upsert({
        where: { platform_username: { platform: 'instagram', username } },
        create: { platform: 'instagram', username },
        update: {},
      })
      const createData: any = {
        brandId,
        socialProfileId: profile.id,
        monitoringType: opts.monitoringType ?? 'content',
        isActive: opts.isActive ?? true,
      }
      if (opts.settings) {
        createData.settings = opts.settings
      }

      const updateData: any = {}
      if (opts.monitoringType) updateData.monitoringType = opts.monitoringType
      if (opts.settings) updateData.settings = opts.settings
      if (opts.isActive !== undefined) updateData.isActive = opts.isActive

      await this.prisma.socialProfileMonitor.upsert({
        where: { brandId_socialProfileId: { brandId, socialProfileId: profile.id } },
        create: createData,
        update: updateData,
      })
    }
    return { success: true }
  }

  async updateTarget(id: string, data: Record<string, unknown>) {
    return this.prisma.socialProfileMonitor.update({ where: { id }, data })
  }

  async deleteTarget(id: string) {
    await this.prisma.socialProfileMonitor.delete({ where: { id } })
    return { success: true }
  }

  async generateComment(targetUrl: string, brandId: string) {
    const intelligence = await this.prisma.brand.findUnique({ where: { id: brandId } })
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

  async getTargets(brandId: string, monitoringType?: string) {
    return this.prisma.socialProfileMonitor.findMany({
      where: { brandId, monitoringType: monitoringType ?? undefined },
      include: {
        socialProfile: { include: { _count: { select: { posts: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async patchTarget(id: string, data: { isActive?: boolean; settings?: Record<string, unknown> }) {
    const patch: Record<string, unknown> = {}
    if (data.isActive !== undefined) patch.isActive = data.isActive
    if (data.settings !== undefined) patch.settings = data.settings
    return this.prisma.socialProfileMonitor.update({ where: { id }, data: patch })
  }
}

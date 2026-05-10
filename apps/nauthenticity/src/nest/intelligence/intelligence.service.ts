import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { IngestionService } from '../ingestion/ingestion.service'
import { runProactiveFanout } from '../../modules/proactive/fanout.processor'
import { generateReactiveComments } from '../../modules/proactive/reactive.service'

export type Category = 'COMMENT' | 'INSPO' | 'BENCHMARK'
export const CATEGORIES: readonly Category[] = ['COMMENT', 'INSPO', 'BENCHMARK'] as const

export function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value)
}

@Injectable()
export class IntelligenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ingestion: IngestionService,
  ) {}

  async getIntelligence(brandId: string) {
    const intelligence = await this.prisma.brand.findUnique({
      where: { id: brandId },
      include: {
        categoryMemberships: {
          select: {
            id: true,
            socialProfile: { select: { username: true } },
            postId: true,
            category: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
    })
    return intelligence ?? null
  }

  async upsertIntelligence(brandId: string, data: Record<string, unknown>) {
    const allowed = ['workspaceId', 'mainUsername', 'commentPrompt', 'suggestionsCount', 'windowStart', 'windowEnd', 'timezone']
    const patch: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in data) patch[key] = data[key]
    }
    return this.prisma.brand.upsert({
      where: { id: brandId },
      create: {
        id: brandId,
        workspaceId: (patch.workspaceId as string) ?? '',
        ...patch,
      },
      update: patch,
    })
  }

  async getDna(brandId: string) {
    const intelligence = await this.prisma.brand.findUnique({
      where: { id: brandId },
      include: {
        categoryMemberships: {
          where: { socialProfileId: { not: null } },
          select: { socialProfile: { select: { username: true } }, category: true },
        },
      },
    })
    if (!intelligence) throw new NotFoundException('Brand intelligence not found')
    return {
      brandId: intelligence.id,
      commentPrompt: intelligence.commentPrompt,
      suggestionsCount: intelligence.suggestionsCount,
      memberships: intelligence.categoryMemberships,
    }
  }

  async getDnaLight(brandId: string) {
    const intelligence = await this.prisma.brand.findUnique({
      where: { id: brandId },
      select: { id: true, commentPrompt: true },
    })
    if (!intelligence) throw new NotFoundException('Brand intelligence not found')
    return { brandId: intelligence.id, commentPrompt: intelligence.commentPrompt?.slice(0, 500) ?? null }
  }

  async listServiceBrands(workspaceId: string) {
    return this.prisma.brand.findMany({
      where: { workspaceId },
      include: {
        categoryMemberships: {
          where: { socialProfileId: { not: null } },
          select: { socialProfile: { select: { username: true } }, category: true },
        },
      },
    })
  }

  async syncServiceBrand(brandId: string, data: { workspaceId?: string; mainUsername?: string }) {
    return this.prisma.brand.update({ where: { id: brandId }, data })
  }

  /**
   * Add (or upsert) profile-level memberships under a given category.
   * Called when a user adds usernames to one of: COMMENT, INSPO, BENCHMARK.
   */
  async createProfileMemberships(
    owner: { brandId: string; projectId?: never } | { projectId: string; brandId?: never },
    usernames: string[],
    opts: { category: Category; isActive?: boolean },
  ) {
    const ownerField = 'brandId' in owner && owner.brandId
      ? { brandId: owner.brandId }
      : { projectId: (owner as { projectId: string }).projectId }

    for (const username of usernames) {
      const profile = await this.prisma.socialProfile.upsert({
        where: { platform_username: { platform: 'instagram', username } },
        create: { platform: 'instagram', username },
        update: {},
      })

      const existing = await this.prisma.categoryMembership.findFirst({
        where: { ...ownerField, category: opts.category, socialProfileId: profile.id, postId: null },
        select: { id: true },
      })
      if (existing) {
        await this.prisma.categoryMembership.update({
          where: { id: existing.id },
          data: { isActive: opts.isActive ?? true },
        })
      } else {
        await this.prisma.categoryMembership.create({
          data: { ...ownerField, socialProfileId: profile.id, category: opts.category, isActive: opts.isActive ?? true },
        })
      }

      // For INSPO/BENCHMARK: auto-queue ingestion if not recently scraped (>24h or never).
      // tryQueueIngestion is a no-op if a job for this username is already in-flight.
      if (opts.category !== 'COMMENT') {
        const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000)
        if (!profile.lastScrapedAt || profile.lastScrapedAt < staleThreshold) {
          this.ingestion.tryQueueIngestion(username, 30).catch(() => {})
        }
      }
    }
    return { success: true }
  }

  async updateMembership(id: string, data: { isActive?: boolean; category?: Category }) {
    const patch: Record<string, unknown> = {}
    if (data.isActive !== undefined) patch.isActive = data.isActive
    if (data.category !== undefined) patch.category = data.category
    return this.prisma.categoryMembership.update({ where: { id }, data: patch })
  }

  async deleteMembership(id: string) {
    const membership = await this.prisma.categoryMembership.findUnique({ where: { id } })
    if (!membership) return { success: true }

    await this.prisma.categoryMembership.delete({ where: { id } })

    // Default-absorption only applies to brand memberships (not projects — pure reference, no BENCHMARK sink)
    const { brandId, socialProfileId, postId } = membership
    if (brandId) {
      const remaining = await this.prisma.categoryMembership.count({
        where: { brandId, socialProfileId: socialProfileId ?? undefined, postId: postId ?? undefined },
      })
      if (remaining === 0) {
        await this.prisma.categoryMembership.create({
          data: { brandId, socialProfileId, postId, category: 'BENCHMARK', isActive: true },
        })
      }
    }

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

  /**
   * List profile-level memberships for a brand, optionally filtered by category.
   * (Post-level memberships are managed via the InspoBase / Benchmark/Study endpoints.)
   */
  async getProfileMemberships(
    owner: { brandId: string } | { projectId: string },
    category?: Category,
  ) {
    const ownerFilter = 'brandId' in owner ? { brandId: owner.brandId } : { projectId: owner.projectId }
    return this.prisma.categoryMembership.findMany({
      where: { ...ownerFilter, category: category ?? undefined, socialProfileId: { not: null } },
      include: { socialProfile: { include: { _count: { select: { posts: true } } } } },
      orderBy: { createdAt: 'desc' },
    })
  }
}

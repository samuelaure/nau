import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { runProactiveFanout } from '../../modules/proactive/fanout.processor'
import { generateReactiveComments } from '../../modules/proactive/reactive.service'
import { scrapePostByUrl } from '../../services/apify.service'
import { downloadQueue } from '../../queues/download.queue'
import { upsertSocialProfile } from '../../modules/shared/upsert-social-profile'

export type Category = 'COMMENT' | 'INSPO' | 'BENCHMARK'
export const CATEGORIES: readonly Category[] = ['COMMENT', 'INSPO', 'BENCHMARK'] as const

export function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value)
}

@Injectable()
export class IntelligenceService {
  constructor(private readonly prisma: PrismaService) {}

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
    const allowed = ['workspaceId', 'mainUsername', 'commentPrompt', 'suggestionsCount', 'windowStart', 'windowEnd', 'timezone', 'sourceConceptFreshnessPeriod', 'sourceConceptFreshnessUnit']
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
      const profile = await upsertSocialProfile({ platform: 'instagram', username })

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

      // Clean up redundant post-level memberships for this owner+category that belong to this
      // profile — they're now covered by the profile-level membership above.
      await this.prisma.categoryMembership.deleteMany({
        where: {
          ...ownerField,
          category: opts.category,
          socialProfileId: null,
          post: { socialProfileId: profile.id },
        },
      })
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
   * Capture an individual post into a brand/project membership.
   *
   * Dedup logic: if the Post already exists in DB and all its media are downloaded,
   * we only create the CategoryMembership — no Apify call, no compute.
   * If the Post is new, we scrape it once, store it, queue downloads, then link.
   */
  async capturePost(
    owner: { brandId: string } | { projectId: string },
    postUrl: string,
    category: Category,
  ) {
    const ownerField = 'brandId' in owner ? { brandId: owner.brandId } : { projectId: (owner as { projectId: string }).projectId }

    // 1. Check if post already exists and is fully processed
    const existing = await this.prisma.post.findFirst({
      where: { url: postUrl },
      include: { media: true },
    })

    let postId: string

    if (existing) {
      const allDownloaded = existing.media.every((m) => m.storageUrl !== m.url)
      if (allDownloaded || existing.media.length === 0) {
        // Post is fully processed — just link, no compute
        postId = existing.id
      } else {
        // Post exists but media download is incomplete — queue missing downloads only
        postId = existing.id
        for (const m of existing.media) {
          if (m.storageUrl === m.url) {
            await downloadQueue.add('process-media', {
              postId: existing.id,
              mediaId: m.id,
              url: m.url,
              type: m.type,
              username: existing.username ?? '',
            })
          }
        }
      }
    } else {
      // Post is new — scrape once, store, queue downloads
      const scraped = await scrapePostByUrl(postUrl)
      if (!scraped) throw new NotFoundException('Post not found or could not be scraped')

      const url = scraped.url ?? postUrl
      const username = scraped.author?.username ?? ''

      const socialProfile = username
        ? await upsertSocialProfile({
            platform: 'instagram',
            username,
            externalId: scraped.author.id ?? null,
          })
        : null

      const post = await this.prisma.post.upsert({
        where: { url },
        create: {
          platformId: scraped.id ?? scraped.shortcode,
          url,
          username,
          socialProfileId: socialProfile?.id ?? null,
          caption: scraped.caption ?? null,
          postedAt: scraped.takenAt ? new Date(scraped.takenAt) : new Date(),
          likes: Math.max(0, scraped.likesCount ?? 0),
          comments: Math.max(0, scraped.commentsCount ?? 0),
        },
        update: { likes: Math.max(0, scraped.likesCount ?? 0), comments: Math.max(0, scraped.commentsCount ?? 0) },
        include: { media: true },
      })
      postId = post.id

      // Determine media items from scraped data
      const mediaItems: { type: 'image' | 'video'; url: string }[] = scraped.media ?? []

      for (let i = 0; i < mediaItems.length; i++) {
        const mi = mediaItems[i]
        const existing = post.media.find((m) => m.index === i)
        let mediaId: string
        if (existing) {
          mediaId = existing.id
        } else {
          const created = await this.prisma.media.create({
            data: { postId, type: mi.type, url: mi.url, storageUrl: mi.url, index: i },
          })
          mediaId = created.id
        }
        await downloadQueue.add('process-media', { postId, mediaId, url: mi.url, type: mi.type, username })
      }
    }

    // 2. Create CategoryMembership linking this owner to the post
    const existingMembership = await this.prisma.categoryMembership.findFirst({
      where: { ...ownerField, category, postId, socialProfileId: null },
    })
    if (!existingMembership) {
      await this.prisma.categoryMembership.create({
        data: { ...ownerField, postId, category, isActive: true },
      })
    }

    return { success: true, postId, reused: !!existing }
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

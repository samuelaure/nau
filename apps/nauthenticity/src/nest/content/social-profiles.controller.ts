import { Controller, Post, Get, Body, UseGuards, HttpCode, HttpStatus, BadRequestException, Param } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AnyAuthGuard } from '../auth/any-auth.guard'
import { upsertSocialProfile } from '../../modules/shared/upsert-social-profile'
import { sanitiseUsername } from '../../modules/shared/sanitize-username'
import { ingestionQueue } from '../../queues/ingestion.queue'
import { FlownauSyncService } from '../../modules/sync/flownau-sync.service'
import { Logger } from '@nestjs/common'

@Controller()
@UseGuards(AnyAuthGuard)
export class SocialProfilesController {
  private readonly logger = new Logger(SocialProfilesController.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly flownauSync: FlownauSyncService,
  ) {}

  /**
   * POST /social-profiles/sync
   * Sync a social profile from flownau (or any external source).
   * Dedups primarily by (platform, externalId/platformId) when available, then by (platform, username).
   */
  @Post('social-profiles/sync')
  @HttpCode(HttpStatus.OK)
  async syncProfile(
    @Body()
    body: {
      username: string
      platform?: string
      platformId?: string | null
      profileImageUrl?: string | null
      brandId?: string
      workspaceId?: string
    },
  ) {
    if (!body.username) throw new BadRequestException('Username is required')

    const username = sanitiseUsername(body.username)
    if (!username) throw new BadRequestException('Invalid username')

    const platform = body.platform || 'instagram'

    if (body.brandId) {
      await this.prisma.brand.upsert({
        where: { id: body.brandId },
        update: {},
        create: { id: body.brandId, workspaceId: body.workspaceId || '' },
      })
    }

    const profile = await upsertSocialProfile({
      platform,
      username,
      externalId: body.platformId ?? null,
      extraUpdate: {
        ...(body.profileImageUrl ? { profileImageUrl: body.profileImageUrl } : {}),
        ...(body.brandId ? { ownerId: body.brandId } : {}),
      },
    })

    return { profile, synced: true }
  }

  /**
   * POST /brands/:brandId/owned-profiles
   * Add a profile as owned by this brand, queue a first scrape, and sync to flownau.
   */
  @Post('brands/:brandId/owned-profiles')
  @HttpCode(HttpStatus.OK)
  async addOwnedProfile(
    @Param('brandId') brandId: string,
    @Body() body: { username: string },
  ) {
    if (!body.username) throw new BadRequestException('Username is required')
    const username = sanitiseUsername(body.username)
    if (!username) throw new BadRequestException('Invalid username')

    await this.prisma.brand.upsert({
      where: { id: brandId },
      update: {},
      create: { id: brandId, workspaceId: '' },
    })

    const profile = await upsertSocialProfile({ platform: 'instagram', username })
    await this.prisma.socialProfile.update({
      where: { id: profile.id },
      data: { ownerId: brandId },
    })

    const RECENT_DAYS = 7
    const stale = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000)
    let scrapeQueued = false
    if (!profile.lastScrapedAt || profile.lastScrapedAt < stale) {
      await ingestionQueue.add('ingest', { username, mode: 'FEED', limit: 30 }, { jobId: `feed-${username}-owned-add` })
      scrapeQueued = true
    }

    // Fire-and-forget sync to flownau so it appears immediately in the brand's profiles tab.
    this.flownauSync.syncToFlownau(profile.id).catch((err) => {
      this.logger.warn(`[addOwnedProfile] flownau sync failed for ${username}: ${err}`)
    })

    return { profile, scrapeQueued }
  }

  /**
   * GET /brands/:brandId/owned-profiles
   * Get all owned social profiles for a brand
   */
  @Get('brands/:brandId/owned-profiles')
  async getOwnedProfiles(@Param('brandId') brandId: string) {
    return this.prisma.socialProfile.findMany({
      where: { ownerId: brandId },
      include: { _count: { select: { posts: true } } },
      orderBy: { lastScrapedAt: 'desc' },
    })
  }
}

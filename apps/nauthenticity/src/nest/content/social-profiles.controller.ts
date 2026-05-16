import { Controller, Post, Get, Body, UseGuards, HttpCode, HttpStatus, BadRequestException, Param } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AnyAuthGuard } from '../auth/any-auth.guard'
import { upsertSocialProfile } from '../../modules/shared/upsert-social-profile'
import { ingestionQueue } from '../../queues/ingestion.queue'
import axios from 'axios'
import { Logger } from '@nestjs/common'

function sanitiseUsername(raw: string): string {
  let u = raw.trim()
  if (u.includes('instagram.com/')) u = u.split('instagram.com/')[1] ?? u
  u = u.split('?')[0].split('#')[0].split('/')[0]
  if (u.startsWith('@')) u = u.slice(1)
  return u.replace(/[^a-zA-Z0-9._]/g, '')
}

@Controller()
@UseGuards(AnyAuthGuard)
export class SocialProfilesController {
  private readonly logger = new Logger(SocialProfilesController.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * POST /social-profiles/sync
   * Sync a social profile from flownau (or any external source)
   * Creates or updates the SocialProfile and optionally sets its owner
   */
  @Post('social-profiles/sync')
  @HttpCode(HttpStatus.OK)
  async syncProfile(
    @Body()
    body: {
      username: string
      platform?: string
      profileImageUrl?: string | null
      brandId?: string
      workspaceId?: string
    },
  ) {
    if (!body.username) {
      throw new BadRequestException('Username is required')
    }

    const platform = body.platform || 'instagram'

    // If brandId is provided, ensure the Brand exists in nauthenticity first
    // (Brand identity is managed by 9naŭ API, but nauthenticity needs local record)
    if (body.brandId) {
      await this.prisma.brand.upsert({
        where: { id: body.brandId },
        update: {},
        create: {
          id: body.brandId,
          workspaceId: body.workspaceId || '',
        },
      })
    }

    // Upsert: create if not exists, otherwise return existing
    // If brandId is provided, set the owner; otherwise leave ownerId as-is
    const profile = await this.prisma.socialProfile.upsert({
      where: {
        platform_username: { platform, username: body.username },
      },
      create: {
        platform,
        username: body.username,
        profileImageUrl: body.profileImageUrl || null,
        ownerId: body.brandId || null,
      },
      update: {
        profileImageUrl: body.profileImageUrl || undefined,
        lastScrapedAt: new Date(),
        ownerId: body.brandId || undefined,
      },
    })

    return { profile, synced: true }
  }

  /**
   * POST /brands/:brandId/social-profiles/sync-to-flownau
   * Sync all owned profiles for a brand to flownau
   */
  @Post('brands/:brandId/social-profiles/sync-to-flownau')
  @HttpCode(HttpStatus.OK)
  async syncOwnedProfilesToFlownau(@Param('brandId') brandId: string) {
    const brand = await this.prisma.brand.findUnique({ where: { id: brandId } })
    if (!brand) {
      throw new BadRequestException('Brand not found')
    }

    const profiles = await this.prisma.socialProfile.findMany({
      where: { ownerId: brandId },
    })

    if (profiles.length === 0) {
      return { success: true, synced: 0, message: 'No owned profiles to sync' }
    }

    const flownauUrl = process.env.FLOWNAU_URL || 'http://localhost:3003'
    const serviceKey = process.env.NAU_SERVICE_KEY || ''

    let synced = 0
    const errors: Array<{ username: string; error: string }> = []

    for (const profile of profiles) {
      try {
        const response = await axios.post(
          `${flownauUrl}/api/brands/${brandId}/social-profiles`,
          {
            username: profile.username,
            platform: profile.platform,
            profileImageUrl: profile.profileImageUrl,
            nauthenticityProfileId: profile.id,
            syncedFromNauthenticity: true,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Nau-Service-Key': serviceKey,
            },
            timeout: 10_000,
          },
        )

        if (response.status === 201 || response.status === 200) {
          synced++
          this.logger.log(
            `[SyncToFlownau] Synced profile ${profile.username} (${profile.platform}) for brand ${brandId}`,
          )
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        errors.push({ username: profile.username, error: msg })
        this.logger.error(
          `[SyncToFlownau] Failed to sync profile ${profile.username}: ${msg}`,
        )
      }
    }

    return {
      success: synced > 0,
      synced,
      total: profiles.length,
      errors: errors.length > 0 ? errors : undefined,
    }
  }

  /**
   * POST /brands/:brandId/owned-profiles
   * Add a profile as owned by this brand, then queue a 30-post scrape.
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

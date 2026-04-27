import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AnyAuthGuard } from '../auth/any-auth.guard'

@Controller()
@UseGuards(AnyAuthGuard)
export class SocialProfilesController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * POST /social-profiles/sync
   * Sync a social profile from flownau (or any external source)
   * Creates the SocialProfile if it doesn't exist, and optionally links it to a brand
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
      targetType?: string
    },
  ) {
    if (!body.username) {
      throw new BadRequestException('Username is required')
    }

    const platform = body.platform || 'instagram'

    // Upsert: create if not exists, otherwise return existing
    const profile = await this.prisma.socialProfile.upsert({
      where: {
        platform_username: { platform, username: body.username },
      },
      create: {
        platform,
        username: body.username,
        profileImageUrl: body.profileImageUrl || null,
      },
      update: {
        profileImageUrl: body.profileImageUrl || undefined,
        lastScrapedAt: new Date(),
      },
    })

    // If brandId is provided, link this profile to the brand as a publishing profile
    if (body.brandId) {
      try {
        await this.prisma.socialProfileTarget.upsert({
          where: {
            brandId_socialProfileId: { brandId: body.brandId, socialProfileId: profile.id },
          },
          create: {
            brandId: body.brandId,
            socialProfileId: profile.id,
            targetType: body.targetType || 'publishing',
            isPublishingProfile: true,
          },
          update: {
            targetType: body.targetType || 'publishing',
            isPublishingProfile: true,
          },
        })
      } catch (err: any) {
        // If brand doesn't exist yet, just log warning and continue
        // The profile will be synced, but not yet linked to a brand
        console.warn(`[SyncProfile] Brand ${body.brandId} not found in nauthenticity, profile synced without brand link`)
      }
    }

    return { profile, synced: true }
  }
}

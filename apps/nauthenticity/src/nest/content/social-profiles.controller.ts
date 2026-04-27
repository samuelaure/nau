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
   * Creates the SocialProfile if it doesn't exist
   */
  @Post('social-profiles/sync')
  @HttpCode(HttpStatus.OK)
  async syncProfile(
    @Body() body: { username: string; platform?: string; profileImageUrl?: string | null },
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

    return { profile, synced: true }
  }
}

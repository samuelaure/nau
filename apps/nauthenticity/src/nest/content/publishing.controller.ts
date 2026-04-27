import { Controller, Post, Put, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { FlownauSyncService } from '../../modules/sync/flownau-sync.service'
import { AnyAuthGuard } from '../auth/any-auth.guard'
import { ConfigService } from '@nestjs/config'

@Controller()
@UseGuards(AnyAuthGuard)
export class PublishingController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly syncService: FlownauSyncService,
    private readonly config: ConfigService,
  ) {}

  /**
   * PUT /social-profile-targets/{targetId}/publishing
   * Toggle a social profile as publishing (owned) and sync to flownau
   */
  @Put('social-profile-targets/:targetId/publishing')
  @HttpCode(HttpStatus.OK)
  async setPublishing(
    @Param('targetId') targetId: string,
    @Body() body: { isPublishingProfile: boolean },
  ) {
    const target = await this.prisma.socialProfileTarget.update({
      where: { id: targetId },
      data: { isPublishingProfile: body.isPublishingProfile },
      include: { socialProfile: true, brand: true },
    })

    // If being marked as publishing, sync to flownau
    if (body.isPublishingProfile && !target.syncedToFlownauAt) {
      const serviceKey = this.config.get('NAU_SERVICE_KEY') || ''
      await this.syncService.syncToFlownau(targetId, serviceKey)
    }

    return { target, synced: target.syncedToFlownauAt ? true : false }
  }

  /**
   * POST /brands/{brandId}/social-profiles/sync
   * Manually trigger sync of all publishing profiles for a brand to flownau
   */
  @Post('brands/:brandId/social-profiles/sync')
  @HttpCode(HttpStatus.OK)
  async syncBrandProfiles(@Param('brandId') brandId: string) {
    const serviceKey = this.config.get('NAU_SERVICE_KEY') || ''
    const syncedCount = await this.syncService.syncBrandProfiles(brandId, serviceKey)
    return { syncedCount }
  }
}

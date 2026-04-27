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
   * Mark a profile as owned by a brand and sync to flownau
   */
  @Put('social-profile-targets/:targetId/publishing')
  @HttpCode(HttpStatus.OK)
  async setPublishing(
    @Param('targetId') targetId: string,
    @Body() body: { isOwned: boolean },
  ) {
    const monitor = await this.prisma.socialProfileMonitor.findUnique({
      where: { id: targetId },
      include: { socialProfile: true, brand: true },
    })
    if (!monitor) throw new Error('Monitor not found')

    if (body.isOwned) {
      await this.prisma.socialProfile.update({
        where: { id: monitor.socialProfileId },
        data: { ownerId: monitor.brandId },
      })

      const serviceKey = this.config.get('NAU_SERVICE_KEY') || ''
      await this.syncService.syncToFlownau(monitor.socialProfileId, serviceKey)
    } else {
      await this.prisma.socialProfile.update({
        where: { id: monitor.socialProfileId },
        data: { ownerId: null },
      })
    }

    return { success: true, isOwned: body.isOwned }
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

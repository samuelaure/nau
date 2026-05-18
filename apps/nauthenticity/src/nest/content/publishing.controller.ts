import { Controller, Put, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { FlownauSyncService } from '../../modules/sync/flownau-sync.service'
import { AnyAuthGuard } from '../auth/any-auth.guard'

@Controller()
@UseGuards(AnyAuthGuard)
export class PublishingController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly syncService: FlownauSyncService,
  ) {}

  /**
   * PUT /social-profile-targets/{membershipId}/publishing
   * Mark a profile as owned (OWN category) by a brand and sync to flownau.
   */
  @Put('social-profile-targets/:membershipId/publishing')
  @HttpCode(HttpStatus.OK)
  async setPublishing(
    @Param('membershipId') membershipId: string,
    @Body() body: { isOwned: boolean },
  ) {
    const membership = await this.prisma.categoryMembership.findUnique({
      where: { id: membershipId },
      include: { socialProfile: true, brand: true },
    })
    if (!membership) throw new Error('Membership not found')
    if (!membership.socialProfileId) throw new Error('Membership is not profile-level')

    if (body.isOwned) {
      await this.prisma.socialProfile.update({
        where: { id: membership.socialProfileId },
        data: { ownerId: membership.brandId },
      })
      await this.syncService.syncToFlownau(membership.socialProfileId)
    } else {
      await this.prisma.socialProfile.update({
        where: { id: membership.socialProfileId },
        data: { ownerId: null },
      })
    }

    return { success: true, isOwned: body.isOwned }
  }
}

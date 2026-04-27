import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../nest/prisma/prisma.service'
import axios from 'axios'

/**
 * Syncs SocialProfileTargets marked as publishing profiles to flownau.
 * When a profile is marked with isPublishingProfile: true, it creates a
 * corresponding SocialProfile in flownau (with null tokens, awaiting OAuth).
 */
@Injectable()
export class FlownauSyncService {
  private readonly logger = new Logger(FlownauSyncService.name)
  private flownauUrl: string

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.flownauUrl = this.config.get('FLOWNAU_URL') || 'http://localhost:3003'
  }

  /**
   * Sync a SocialProfileTarget to flownau if it's marked as publishing
   */
  async syncToFlownau(targetId: string, internalServiceKey: string): Promise<void> {
    try {
      const target = await this.prisma.socialProfileTarget.findUnique({
        where: { id: targetId },
        include: {
          socialProfile: true,
          brand: true,
        },
      })

      if (!target || !target.isPublishingProfile) {
        this.logger.debug(`[FlownauSync] Target ${targetId} not marked for publishing, skipping`)
        return
      }

      const { username, platform } = target.socialProfile

      // Call flownau API to create soft profile
      // Note: nauthenticity BrandIntelligence.brandId === flownau Brand.id
      const response = await axios.post(
        `${this.flownauUrl}/api/brands/${target.brandId}/social-profiles`,
        {
          username,
          platform: 'instagram',
          nauthenticityProfileId: target.socialProfileId,
          syncedFromNauthenticity: true,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Key': internalServiceKey,
          },
          timeout: 10_000,
        },
      )

      // Mark as synced
      await this.prisma.socialProfileTarget.update({
        where: { id: targetId },
        data: { syncedToFlownauAt: new Date() },
      })

      this.logger.log(
        `[FlownauSync] Synced profile ${username} (${platform}) to flownau brand ${target.brandId}`,
      )
    } catch (error) {
      this.logger.error(`[FlownauSync] Failed to sync target ${targetId}:`, error)
      // Don't throw — log and continue. Manual retry via API is preferred.
    }
  }

  /**
   * Called when isPublishingProfile is toggled on a profile
   */
  async onPublishingProfileEnabled(targetId: string, internalServiceKey: string): Promise<void> {
    await this.syncToFlownau(targetId, internalServiceKey)
  }

  /**
   * Batch sync all publishing profiles for a brand
   */
  async syncBrandProfiles(brandId: string, internalServiceKey: string): Promise<number> {
    const targets = await this.prisma.socialProfileTarget.findMany({
      where: { brandId, isPublishingProfile: true, syncedToFlownauAt: null },
    })

    let synced = 0
    for (const target of targets) {
      try {
        await this.syncToFlownau(target.id, internalServiceKey)
        synced++
      } catch (error) {
        this.logger.error(`Failed to sync target ${target.id}:`, error)
      }
    }

    return synced
  }
}

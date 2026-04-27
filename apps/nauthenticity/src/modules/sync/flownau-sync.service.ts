import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../nest/prisma/prisma.service'
import axios from 'axios'

/**
 * Syncs SocialProfiles owned by a brand to flownau.
 * When a SocialProfile has ownerId set to a brand, it creates a corresponding
 * SocialProfile in flownau (with null tokens, awaiting OAuth).
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
   * Sync a SocialProfile to flownau if it's owned by a brand
   */
  async syncToFlownau(profileId: string, internalServiceKey: string): Promise<void> {
    try {
      const profile = await this.prisma.socialProfile.findUnique({
        where: { id: profileId },
        include: { owner: true },
      })

      if (!profile || !profile.ownerId) {
        this.logger.debug(`[FlownauSync] Profile ${profileId} has no owner, skipping`)
        return
      }

      const { username, platform, ownerId } = profile

      // Call flownau API to create soft profile
      // Note: nauthenticity Brand.id === flownau Brand.id === API Brand.id
      await axios.post(
        `${this.flownauUrl}/api/brands/${ownerId}/social-profiles`,
        {
          username,
          platform,
          nauthenticityProfileId: profileId,
          syncedFromNauthenticity: true,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Nau-Service-Key': internalServiceKey,
          },
          timeout: 10_000,
        },
      )

      this.logger.log(
        `[FlownauSync] Synced profile ${username} (${platform}) to flownau brand ${ownerId}`,
      )
    } catch (error) {
      this.logger.error(`[FlownauSync] Failed to sync profile ${profileId}:`, error)
      // Don't throw — log and continue. Manual retry via API is preferred.
    }
  }

  /**
   * Called when a profile is assigned an owner
   */
  async onOwnershipAssigned(profileId: string, internalServiceKey: string): Promise<void> {
    await this.syncToFlownau(profileId, internalServiceKey)
  }

  /**
   * Batch sync all owned profiles for a brand
   */
  async syncBrandProfiles(brandId: string, internalServiceKey: string): Promise<number> {
    const profiles = await this.prisma.socialProfile.findMany({
      where: { ownerId: brandId },
    })

    let synced = 0
    for (const profile of profiles) {
      try {
        await this.syncToFlownau(profile.id, internalServiceKey)
        synced++
      } catch (error) {
        this.logger.error(`Failed to sync profile ${profile.id}:`, error)
      }
    }

    return synced
  }
}

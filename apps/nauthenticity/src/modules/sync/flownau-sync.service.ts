import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../nest/prisma/prisma.service'
import { signServiceToken } from '@nau/auth'
import axios from 'axios'

@Injectable()
export class FlownauSyncService {
  private readonly logger = new Logger(FlownauSyncService.name)
  private readonly flownauUrl: string
  private readonly authSecret: string

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.flownauUrl = this.config.get<string>('FLOWNAU_URL') || 'http://localhost:3003'
    this.authSecret = this.config.get<string>('AUTH_SECRET') || ''
  }

  private async serviceToken(): Promise<string> {
    return signServiceToken({ secret: this.authSecret, iss: 'nauthenticity', aud: 'flownau' })
  }

  /**
   * Create the SocialProfile in flownau if it doesn't already exist there.
   * Idempotent on the flownau side (deduped by brandId+username+platform and platformId).
   */
  async syncToFlownau(profileId: string): Promise<void> {
    const profile = await this.prisma.socialProfile.findUnique({
      where: { id: profileId },
      select: {
        id: true,
        ownerId: true,
        username: true,
        platform: true,
        externalId: true,
        profileImageUrl: true,
      },
    })

    if (!profile || !profile.ownerId) {
      this.logger.debug(`[FlownauSync] Profile ${profileId} has no owner — skipping`)
      return
    }
    if (!this.authSecret) {
      this.logger.warn('[FlownauSync] AUTH_SECRET missing — cannot sync')
      return
    }

    try {
      const token = await this.serviceToken()
      await axios.post(
        `${this.flownauUrl}/api/brands/${profile.ownerId}/social-profiles`,
        {
          username: profile.username,
          platform: profile.platform,
          platformId: profile.externalId ?? null,
          profileImage: profile.profileImageUrl ?? null,
          nauthenticityProfileId: profile.id,
          syncedFromNauthenticity: true,
        },
        {
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          timeout: 10_000,
          // 409 (already exists) is not an error for our purposes.
          validateStatus: (s) => (s >= 200 && s < 300) || s === 409,
        },
      )
      this.logger.log(`[FlownauSync] Synced ${profile.username} → flownau brand ${profile.ownerId}`)
    } catch (err) {
      this.logger.error(`[FlownauSync] Failed for ${profileId}: ${err}`)
    }
  }

  /**
   * Push updated metadata (image, platformId) for a profile to flownau.
   * Called after a scrape that updates these fields.
   */
  async pushProfileMetadata(profileId: string): Promise<void> {
    const profile = await this.prisma.socialProfile.findUnique({
      where: { id: profileId },
      select: { id: true, ownerId: true, externalId: true, profileImageUrl: true, username: true, platform: true },
    })
    if (!profile || !profile.ownerId) return
    if (!this.authSecret) return

    try {
      const token = await this.serviceToken()
      await axios.patch(
        `${this.flownauUrl}/api/_service/social-profiles/by-nauthenticity/${profile.id}`,
        {
          platformId: profile.externalId ?? null,
          profileImage: profile.profileImageUrl ?? null,
          username: profile.username,
          platform: profile.platform,
        },
        {
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          timeout: 10_000,
        },
      )
      this.logger.log(`[FlownauSync] Pushed metadata for ${profile.username} → flownau`)
    } catch (err) {
      this.logger.error(`[FlownauSync] Metadata push failed for ${profileId}: ${err}`)
    }
  }
}

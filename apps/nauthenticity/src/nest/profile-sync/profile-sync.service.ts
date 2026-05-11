import { Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import { IngestionService } from '../ingestion/ingestion.service'
import { getProfileInfo } from '../../services/apify.service'
import { logger } from '../../utils/logger'
import { signServiceToken } from '@nau/auth'

@Injectable()
export class ProfileSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ingestion: IngestionService,
    private readonly config: ConfigService,
  ) {}

  async syncProfile(profileId: string): Promise<{
    igPostCount: number
    nauPostCount: number
    igDelta: number
    nauDelta: number
    action: 'in_sync' | 'scrape_triggered' | 'flownau_backfill_triggered'
    scrapeTriggered: boolean
  }> {
    const profile = await this.prisma.socialProfile.findUnique({ where: { id: profileId } })
    if (!profile) throw new NotFoundException('SocialProfile not found')

    // 1. Fetch fresh profile data from IG (profile-only, no posts)
    const igProfile = await getProfileInfo(profile.username)
    const igPostCount = igProfile?.postsCount ?? profile.totalPostCount ?? 0

    // Update profile metadata from fresh fetch
    if (igProfile) {
      await this.prisma.socialProfile.update({
        where: { id: profileId },
        data: {
          profileImageUrl: igProfile.profilePicUrl ?? profile.profileImageUrl,
          totalPostCount: igPostCount,
          ...(igProfile.id ? { externalId: igProfile.id } : {}),
        },
      })
    }

    // 2. Count nauthenticity posts for this profile
    const nauPostCount = await this.prisma.post.count({ where: { socialProfileId: profileId } })

    // 3. Load last snapshot for delta comparison
    const lastSnapshot = await this.prisma.profileSyncSnapshot.findFirst({
      where: { socialProfileId: profileId },
      orderBy: { createdAt: 'desc' },
    })

    const igDelta = lastSnapshot ? igPostCount - lastSnapshot.igPostCount : igPostCount - nauPostCount
    const nauDelta = lastSnapshot ? nauPostCount - lastSnapshot.nauPostCount : 0

    logger.info(
      { profileId, igPostCount, nauPostCount, igDelta, nauDelta, hasSnapshot: !!lastSnapshot },
      '[ProfileSync] Sync evaluation',
    )

    let scrapeTriggered = false
    let action: 'in_sync' | 'scrape_triggered' | 'flownau_backfill_triggered' = 'in_sync'

    // 4. Decision: if deltas match, we captured everything since last sync
    const hasMissedPosts = igDelta > nauDelta

    if (hasMissedPosts) {
      // 4a. OWN profiles: try flownau backfill first (fire & forget)
      if (profile.ownerId) {
        this.backfillFromFlownau(profileId, profile.username).catch((err) => {
          logger.error({ profileId, err }, '[ProfileSync] Flownau backfill failed')
        })
        action = 'flownau_backfill_triggered'
      }

      // 4b. Trigger date-based ingestion from lastScrapedAt
      const oldestPostDate = profile.lastScrapedAt
        ? profile.lastScrapedAt.toISOString().split('T')[0]
        : undefined

      logger.info({ profileId, oldestPostDate }, '[ProfileSync] Triggering date-based scrape')

      const queued = await this.ingestion.tryQueueIngestion(
        profile.username,
        200,
        true, // updateSync — uses oldestPostDate from lastScrapedAt in ingester
      )

      if (queued) {
        scrapeTriggered = true
        action = 'scrape_triggered'
      }
    }

    // 5. Save snapshot
    await this.prisma.profileSyncSnapshot.create({
      data: { socialProfileId: profileId, igPostCount, nauPostCount, scrapeTriggered },
    })

    return { igPostCount, nauPostCount, igDelta, nauDelta, action, scrapeTriggered }
  }

  private async backfillFromFlownau(profileId: string, username: string): Promise<void> {
    const flownauUrl = this.config.get<string>('FLOWNAU_URL')
    const authSecret = this.config.get<string>('AUTH_SECRET')
    if (!flownauUrl || !authSecret) return

    const token = await signServiceToken({ secret: authSecret, iss: 'nauthenticity', aud: 'flownau' })

    const res = await fetch(`${flownauUrl}/_service/social-profiles/${profileId}/published-posts`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      logger.warn({ profileId, status: res.status }, '[ProfileSync] Flownau backfill HTTP error')
      return
    }

    const posts = (await res.json()) as Array<{
      flownauPostId: string
      externalPostId: string | null
      url: string
      caption: string | null
      publishedAt: string
      postSynthesis: string | null
      videoUrl: string | null
      coverUrl: string | null
      format: string | null
    }>

    let synced = 0
    for (const post of posts) {
      const exists = await this.prisma.post.findUnique({ where: { url: post.url } })
      if (exists) continue

      const igProfile = await this.prisma.socialProfile.findUnique({ where: { id: profileId } })
      if (!igProfile) continue

      await this.prisma.post.create({
        data: {
          platformId: post.externalPostId ?? `flownau:${post.flownauPostId}`,
          url: post.url,
          username,
          socialProfileId: profileId,
          caption: post.caption,
          originalCaption: post.caption,
          postedAt: new Date(post.publishedAt),
          postSynthesis: post.postSynthesis ?? null,
          media: post.videoUrl
            ? {
                create: [{
                  type: post.format ?? 'video',
                  url: post.videoUrl,
                  storageUrl: post.videoUrl,
                  thumbnailUrl: post.coverUrl ?? null,
                  index: 0,
                }],
              }
            : undefined,
        },
      })
      synced++
    }

    logger.info({ profileId, synced, total: posts.length }, '[ProfileSync] Flownau backfill complete')
  }
}

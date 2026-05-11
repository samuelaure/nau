import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

export interface PostSyncPayload {
  flownauPostId: string
  nauthenticityProfileId: string
  externalPostId: string | null
  url: string
  caption: string | null
  postedAt: Date
  postSynthesis: string | null
  media: Array<{
    type: string
    url: string
    thumbnailUrl?: string | null
    duration?: number | null
    index: number
  }>
}

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  async syncPublishedPost(payload: PostSyncPayload) {
    const { flownauPostId, nauthenticityProfileId, externalPostId, url, caption, postedAt, postSynthesis, media } = payload

    const existing = await this.prisma.post.findUnique({ where: { url } })
    if (existing) return existing

    const profile = await this.prisma.socialProfile.findUnique({ where: { id: nauthenticityProfileId } })
    if (!profile) return null

    return this.prisma.post.create({
      data: {
        platformId: externalPostId ?? `flownau:${flownauPostId}`,
        url,
        username: profile.username ?? undefined,
        socialProfileId: nauthenticityProfileId,
        caption,
        originalCaption: caption,
        postedAt,
        postSynthesis,
        media: {
          create: media.map((m) => ({
            type: m.type,
            url: m.url,
            storageUrl: m.url,
            thumbnailUrl: m.thumbnailUrl ?? null,
            duration: m.duration ?? null,
            index: m.index,
          })),
        },
      },
    })
  }
}

import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import { StartScrapingDto, IngestPostsDto } from './scraping.dto'

@Injectable()
export class ScrapingService {
  private readonly logger = new Logger(ScrapingService.name)
  private readonly apifyToken: string
  private readonly apifyBaseUrl = 'https://api.apify.com/v2'

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.apifyToken = this.config.getOrThrow('APIFY_TOKEN')
  }

  async startRun(dto: StartScrapingDto) {
    const platform = dto.platform ?? 'INSTAGRAM'
    const actorId = this.getActorId(platform)

    const runs = await Promise.all(
      dto.targets.map((target) =>
        this.createAndTriggerRun(dto.brandId, platform, target, dto.limit ?? 50, actorId),
      ),
    )
    return { runs }
  }

  private async createAndTriggerRun(
    brandId: string,
    platform: string,
    username: string,
    limit: number,
    actorId: string,
  ) {
    const run = await this.prisma.scrapingRun.create({
      data: { brandId: brandId, platform, username, status: 'running' },
    })

    this.callApify(run.id, actorId, platform, username, limit).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      this.logger.error(`Apify failed for ${username}: ${msg}`)
      void this.prisma.scrapingRun.update({
        where: { id: run.id },
        data: { status: 'failed' },
      })
    })

    return { runId: run.id, username, status: 'running' }
  }

  private async callApify(runId: string, actorId: string, platform: string, username: string, limit: number) {
    const input = this.buildActorInput(platform, username, limit)

    const res = await fetch(
      `${this.apifyBaseUrl}/acts/${actorId}/runs?token=${this.apifyToken}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) },
    )
    if (!res.ok) throw new Error(`Apify returned ${res.status}`)

    const data = (await res.json()) as { data: { id: string; defaultDatasetId: string } }
    await this.prisma.scrapingRun.update({
      where: { id: runId },
      data: { actorRunId: data.data.id, datasetId: data.data.defaultDatasetId },
    })
    this.logger.log(`Apify run ${data.data.id} started for ${username}`)
  }

  async ingestPosts(dto: IngestPostsDto) {
    const run = await this.prisma.scrapingRun.findUnique({ where: { id: dto.runId } })
    if (!run) throw new NotFoundException('Scraping run not found')

    let saved = 0
    for (const post of dto.posts) {
      const platformId = post.id
      const platform = (post.platform ?? run.platform) as string

      await this.prisma.post.upsert({
        where: { platform_platformId: { platform, platformId } },
        create: {
          platform,
          platformId,
          url: post.url ?? '',
          username: post.username,
          caption: post.caption,
          postedAt: post.postedAt ? new Date(post.postedAt) : new Date(),
          likes: post.likes ?? 0,
          comments: post.comments ?? 0,
          views: post.views,
          runId: run.id,
        },
        update: {
          likes: post.likes ?? 0,
          comments: post.comments ?? 0,
          views: post.views,
        },
      })
      saved++
    }

    await this.prisma.scrapingRun.update({
      where: { id: dto.runId },
      data: { status: 'completed', phase: 'finished' },
    })

    this.logger.log(`Ingested ${saved} posts for run ${dto.runId}`)
    return { saved }
  }

  async listRuns(brandId: string) {
    return this.prisma.scrapingRun.findMany({
      where: { brandId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  }

  async getRun(id: string) {
    const run = await this.prisma.scrapingRun.findUnique({ where: { id } })
    if (!run) throw new NotFoundException('Scraping run not found')
    return run
  }

  private getActorId(platform: string): string {
    const actors: Record<string, string> = {
      INSTAGRAM: 'apify~instagram-scraper',
      TIKTOK: 'clockworks~tiktok-scraper',
      YOUTUBE: 'bernardo~youtube-scraper',
      TWITTER: 'quacker~twitter-scraper',
    }
    return actors[platform] ?? 'apify~instagram-scraper'
  }

  private buildActorInput(platform: string, username: string, limit: number): object {
    if (platform === 'INSTAGRAM') return { usernames: [username], resultsLimit: limit }
    if (platform === 'TIKTOK') return { profiles: [username], resultsPerPage: limit }
    return { target: username, limit }
  }
}

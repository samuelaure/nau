import { Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import { ingestionQueue } from '../../queues/ingestion.queue'
import { downloadQueue } from '../../queues/download.queue'
import { computeQueue } from '../../queues/compute.queue'

@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async listAccounts(page: number, limit: number) {
    const skip = (page - 1) * limit
    const [accounts, total] = await Promise.all([
      this.prisma.socialProfile.findMany({
        where: { posts: { some: {} } },
        orderBy: { lastScrapedAt: 'desc' },
        include: { _count: { select: { posts: true } } },
        skip,
        take: limit,
      }),
      this.prisma.socialProfile.count({ where: { posts: { some: {} } } }),
    ])
    return { accounts, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } }
  }

  async getAccount(username: string) {
    const account = await this.prisma.socialProfile.findUnique({
      where: { platform_username: { platform: 'instagram', username } },
      include: {
        posts: {
          orderBy: { postedAt: 'desc' },
          include: { media: true, transcripts: true },
        },
      },
    })
    if (!account) throw new NotFoundException('SocialProfile not found')
    return account
  }

  async exportAccountTxt(username: string): Promise<string> {
    const account = await this.prisma.socialProfile.findUnique({
      where: { platform_username: { platform: 'instagram', username } },
      include: {
        posts: { orderBy: { postedAt: 'desc' }, include: { transcripts: true } },
      },
    })
    if (!account) throw new NotFoundException('SocialProfile not found')

    let output = `DATA EXPORT FOR: ${account.username}\n`
    output += `Generated on: ${new Date().toISOString()}\n`
    output += `Total Posts: ${account.posts.length}\n`
    output += `==================================================\n\n`
    for (const post of account.posts) {
      output += `Post ID: ${post.id}\nURL: ${post.instagramUrl}\nPosted At: ${post.postedAt.toISOString()}\nCaption:\n${post.caption ?? '(No caption)'}\n\n`
      const t = post.transcripts[0]
      output += t ? `Transcription:\n${t.text}\n` : `Transcription: N/A\n`
      output += `\n--------------------------------------------------\n\n`
    }
    return output
  }

  async getPost(id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: { media: true, transcripts: true, socialProfile: true },
    })
    if (!post) throw new NotFoundException('Post not found')

    const [newerPost, olderPost] = await Promise.all([
      this.prisma.post.findFirst({
        where: { username: post.username, postedAt: { gt: post.postedAt } },
        orderBy: { postedAt: 'asc' },
        select: { id: true },
      }),
      this.prisma.post.findFirst({
        where: { username: post.username, postedAt: { lt: post.postedAt } },
        orderBy: { postedAt: 'desc' },
        select: { id: true },
      }),
    ])
    return { ...post, newerPostId: newerPost?.id ?? null, olderPostId: olderPost?.id ?? null }
  }

  async updatePost(id: string, caption?: string, transcriptText?: string) {
    const post = await this.prisma.post.findUnique({ where: { id }, include: { transcripts: true } })
    if (!post) throw new NotFoundException('Post not found')

    if (caption !== undefined && caption !== post.caption) {
      await this.prisma.post.update({
        where: { id },
        data: { caption, originalCaption: post.originalCaption ?? post.caption },
      })
    }
    if (transcriptText !== undefined) {
      if (post.transcripts.length > 0) {
        const t = post.transcripts[0]
        if (t.text !== transcriptText) {
          await this.prisma.transcript.update({
            where: { id: t.id },
            data: { text: transcriptText, originalText: t.originalText ?? t.text },
          })
        }
      } else {
        await this.prisma.transcript.create({ data: { postId: id, text: transcriptText, originalText: '' } })
      }
    }
    return { success: true }
  }

  async getProgress(username: string) {
    const [totalPosts, totalMedia, localMedia, totalTranscripts, activeRun] = await Promise.all([
      this.prisma.post.count({ where: { username } }),
      this.prisma.media.count({ where: { post: { username } } }),
      this.prisma.media.count({ where: { post: { username }, storageUrl: { startsWith: '/content/' } } }),
      this.prisma.transcript.count({ where: { post: { username } } }),
      this.prisma.scrapingRun.findFirst({ where: { username, status: 'pending' }, orderBy: { createdAt: 'desc' } }),
    ])

    const ongoingRun = activeRun ?? await this.prisma.scrapingRun.findFirst({
      where: { username },
      orderBy: { createdAt: 'desc' },
    })

    const posts = await this.prisma.post.findMany({
      where: { username },
      orderBy: { postedAt: 'desc' },
      take: 200,
      select: {
        id: true,
        instagramId: true,
        postedAt: true,
        caption: true,
        media: { select: { id: true, type: true, storageUrl: true } },
        transcripts: { select: { id: true, text: true }, take: 1 },
      },
    })

    const videoPosts = posts.filter((p) => p.media.some((m) => m.type === 'video'))
    const videoWithTranscript = videoPosts.filter((p) => p.transcripts.length > 0)

    const [activeIng, activeDl, activeComp] = await Promise.all([
      ingestionQueue.getJobs(['active']),
      downloadQueue.getJobs(['active']),
      computeQueue.getJobs(['active']),
    ])
    const activeJobs = [...activeIng, ...activeDl, ...activeComp]
      .filter((j) => j.data.username === username)
      .map((j) => ({ id: j.id, name: j.name, progress: j.progress, data: j.data, timestamp: j.timestamp }))

    return {
      summary: {
        totalPosts,
        totalMedia,
        localMedia,
        pendingDownloads: totalMedia - localMedia,
        downloadPct: totalMedia > 0 ? Math.round((localMedia / totalMedia) * 100) : 0,
        videoPostsTotal: videoPosts.length,
        transcribedPosts: videoWithTranscript.length,
        transcriptPct: videoPosts.length > 0
          ? Math.round((videoWithTranscript.length / videoPosts.length) * 100)
          : 0,
        totalTranscripts,
        phase: ongoingRun?.status === 'completed' && ongoingRun?.phase === 'finished'
          ? 'idle'
          : ongoingRun?.phase ?? 'idle',
        status: ongoingRun?.status ?? 'idle',
        isPaused: ongoingRun?.isPaused ?? false,
      },
      activeJobs,
      posts: posts.map((p) => ({
        id: p.id,
        instagramId: p.instagramId,
        postedAt: p.postedAt,
        caption: p.caption?.slice(0, 80),
        mediaCount: p.media.length,
        downloaded: p.media.every((m) => m.storageUrl.startsWith('/content/')),
        hasVideo: p.media.some((m) => m.type === 'video'),
        transcribed: p.transcripts.length > 0,
        transcriptPreview: p.transcripts[0]?.text?.slice(0, 80) ?? null,
      })),
    }
  }

  async search(query: string, username?: string, limit = 10) {
    const apiKey = this.config.getOrThrow<string>('OPENAI_API_KEY')
    const { OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey })
    const embedding = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query.replace(/\n/g, ' '),
      encoding_format: 'float',
    })
    const vector = embedding.data[0].embedding

    let results: unknown[]
    if (username) {
      results = await this.prisma.$queryRaw`
        SELECT p.id, p.username, p.caption, p."postedAt",
               t.text as "transcriptText",
               1 - (e.vector <=> ${vector}::vector) as similarity
        FROM "Embedding" e
        JOIN "Transcript" t ON e."transcriptId" = t.id
        JOIN "Post" p ON t."postId" = p.id
        WHERE p.username = ${username}
        ORDER BY similarity DESC LIMIT ${Number(limit)};`
    } else {
      results = await this.prisma.$queryRaw`
        SELECT p.id, p.username, p.caption, p."postedAt",
               t.text as "transcriptText",
               1 - (e.vector <=> ${vector}::vector) as similarity
        FROM "Embedding" e
        JOIN "Transcript" t ON e."transcriptId" = t.id
        JOIN "Post" p ON t."postId" = p.id
        ORDER BY similarity DESC LIMIT ${Number(limit)};`
    }
    return { results }
  }
}

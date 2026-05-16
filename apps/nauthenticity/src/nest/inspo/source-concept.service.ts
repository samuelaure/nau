import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { getClientForFeature, reportUsage } from '@nau/llm-client'
import { ConfigService } from '@nestjs/config'
import { z } from 'zod'

const SourceConceptsOutputSchema = z.object({
  concepts: z.array(z.object({ content: z.string() })),
})

@Injectable()
export class SourceConceptService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async generateFromInspoBase(brandId: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { id: brandId },
      include: { ownedProfiles: { select: { id: true } } },
    })
    if (!brand) throw new NotFoundException('Brand not found')

    // Fetch INSPO post memberships: 20 most recent + up to 20 random (deduplicated).
    const recentMemberships = await this.prisma.categoryMembership.findMany({
      where: { brandId, category: 'INSPO', isActive: true, postId: { not: null } },
      include: { post: { select: { id: true, postSynthesis: true, caption: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    const recentPostIds = new Set(recentMemberships.map((m) => m.postId).filter(Boolean))

    // Random selection: fetch all remaining INSPO post memberships excluding already-selected, shuffle in JS
    const excludeIds = Array.from(recentPostIds) as string[]
    const allOtherMemberships = await this.prisma.categoryMembership.findMany({
      where: {
        brandId,
        category: 'INSPO',
        isActive: true,
        postId: excludeIds.length > 0 ? { notIn: excludeIds } : { not: null },
      },
      include: { post: { select: { id: true, postSynthesis: true, caption: true } } },
    })
    // Fisher-Yates shuffle then take 20
    for (let i = allOtherMemberships.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allOtherMemberships[i], allOtherMemberships[j]] = [allOtherMemberships[j], allOtherMemberships[i]]
    }
    const randomMemberships = allOtherMemberships.slice(0, 20)

    const profileMemberships = await this.prisma.categoryMembership.findMany({
      where: { brandId, category: 'INSPO', isActive: true, socialProfileId: { not: null } },
      include: {
        socialProfile: {
          select: { username: true, profileSynthesis: { select: { content: true } } },
        },
      },
      take: 20,
    })

    // Owned profile posts: recent posts from profiles this brand owns
    const ownedProfileIds = brand.ownedProfiles.map((p) => p.id)
    const ownedPosts = ownedProfileIds.length > 0
      ? await this.prisma.post.findMany({
          where: { socialProfileId: { in: ownedProfileIds } },
          select: { postSynthesis: true, caption: true },
          orderBy: { postedAt: 'desc' },
          take: 20,
        })
      : []

    const voicenotes = await this.prisma.voicenote.findMany({
      where: { brandId },
      select: { cleanTranscription: true, synthesis: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    const youtubeVideos = await this.prisma.youtubeVideo.findMany({
      where: {
        brandId,
        status: 'ready',
        categoryMemberships: { some: { brandId, category: 'INSPO', isActive: true } },
      },
      select: { title: true, synthesis: true },
      orderBy: { createdAt: 'desc' },
      take: 15,
    })

    const blogPosts = await this.prisma.blogPost.findMany({
      where: {
        brandId,
        status: 'ready',
        categoryMemberships: { some: { brandId, category: 'INSPO', isActive: true } },
      },
      select: { title: true, synthesis: true },
      orderBy: { createdAt: 'desc' },
      take: 15,
    })

    const totalItems =
      recentMemberships.length +
      randomMemberships.length +
      profileMemberships.length +
      ownedPosts.length +
      voicenotes.length +
      youtubeVideos.length +
      blogPosts.length
    if (totalItems === 0) {
      throw new UnprocessableEntityException('InspoBase is empty — add posts or profiles first.')
    }

    const inspoLines: string[] = []

    for (const m of recentMemberships) {
      if (!m.post) continue
      const text = m.post.postSynthesis ?? m.post.caption
      if (text) inspoLines.push(text)
    }
    for (const m of randomMemberships) {
      if (!m.post) continue
      const text = m.post.postSynthesis ?? m.post.caption
      if (text) inspoLines.push(text)
    }
    for (const m of profileMemberships) {
      if (!m.socialProfile) continue
      const profileSynthesis = m.socialProfile.profileSynthesis?.content
      if (profileSynthesis) {
        inspoLines.push(`Profile @${m.socialProfile.username}:\n${profileSynthesis}`)
      } else {
        inspoLines.push(`Profile: @${m.socialProfile.username}`)
      }
    }
    for (const p of ownedPosts) {
      const text = p.postSynthesis ?? p.caption
      if (text) inspoLines.push(`[Own content] ${text}`)
    }
    for (const v of voicenotes) {
      const text = v.synthesis ?? v.cleanTranscription
      if (text) inspoLines.push(`[Voicenote] ${text}`)
    }

    for (const v of youtubeVideos) {
      if (v.synthesis) inspoLines.push(`[YouTube: ${v.title ?? 'video'}] ${v.synthesis}`)
    }
    for (const b of blogPosts) {
      if (b.synthesis) inspoLines.push(`[Blog: ${b.title ?? 'article'}] ${b.synthesis}`)
    }

    const systemPrompt = `You are a creative content strategist. You receive a brand's full inspiration pool — a curated mix of inspiring posts and profiles, the brand's own published content, voice notes from the brand team, YouTube videos, and blog posts — and you extract distinct, actionable source concepts from it as a whole.

A source concept is a rich, self-contained angle or topic that can drive a separate batch of content ideas. Each concept must be distinct: no overlap, no repetition.

Generate as many source concepts as genuinely capture distinct angles — be moderate, quality over quantity.

Write all output in ${brand.language}.

Return JSON: { "concepts": [ { "content": "..." }, ... ] }
Each "content" is a paragraph (30–60 words) describing the concept clearly enough for an ideation LLM to work from it independently.`

    const userMessage = `## INSPIRATION POOL\n${inspoLines.join('\n\n')}\n\nExtract source concepts.`

    const { client, model } = getClientForFeature('synthesis')
    const result = await client.chatCompletion({
      model,
      temperature: 0.8,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      responseFormat: { type: 'json_object' },
    })

    const apiURL = this.config.get<string>('NAU_API_URL')
    const authSecret = this.config.get<string>('AUTH_SECRET')
    if (apiURL && authSecret) {
      const { signServiceToken } = await import('@nau/auth')
      signServiceToken({ secret: authSecret, iss: 'nauthenticity', aud: 'api' })
        .then((token) => {
          reportUsage({
            apiUrl: apiURL,
            serviceToken: token,
            workspaceId: brand.workspaceId || '',
            brandId,
            service: 'nauthenticity',
            operation: 'chat_completion',
            usage: result.usage,
          })
        })
        .catch(() => {})
    }

    const parsed = SourceConceptsOutputSchema.parse(JSON.parse(result.content))

    const created = await Promise.all(
      parsed.concepts.map((c) =>
        this.prisma.sourceConcept.create({
          data: { brandId, content: c.content, sourceType: 'inspo_base', status: 'pending' },
        }),
      ),
    )

    return created
  }

  // Returns pending concepts that are within the brand's freshness window, in random order.
  async listPending(brandId: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { id: brandId },
      select: { sourceConceptFreshnessPeriod: true, sourceConceptFreshnessUnit: true },
    })

    const period = brand?.sourceConceptFreshnessPeriod ?? 2
    const unit = brand?.sourceConceptFreshnessUnit ?? 'WEEKS'
    const cutoff = new Date()
    if (unit === 'WEEKS') cutoff.setDate(cutoff.getDate() - period * 7)
    else cutoff.setMonth(cutoff.getMonth() - period)

    return this.prisma.$queryRaw<Array<{ id: string; brandId: string; content: string; sourceType: string; status: string; createdAt: Date; consumedAt: Date | null }>>`
      SELECT id, "brandId", content, "sourceType", status, "createdAt", "consumedAt"
      FROM "SourceConcept"
      WHERE "brandId" = ${brandId}
        AND status = 'pending'
        AND "createdAt" >= ${cutoff}
      ORDER BY RANDOM()
    `
  }

  // Returns pending concepts from the freshness pool; generates new ones only when pool is empty.
  async getOrGenerateForBrand(brandId: string) {
    const pending = await this.listPending(brandId)
    if (pending.length > 0) return pending
    return this.generateFromInspoBase(brandId)
  }

  // Returns all source concepts linked to a social profile — either directly via
  // SourceConceptSource.socialProfileId or via posts that belong to the profile.
  async listForProfile(socialProfileId: string) {
    const [directSources, postSources] = await Promise.all([
      this.prisma.sourceConceptSource.findMany({
        where: { socialProfileId },
        include: { sourceConcept: true },
        orderBy: { sourceConcept: { createdAt: 'desc' } },
      }),
      this.prisma.sourceConceptSource.findMany({
        where: { post: { socialProfileId } },
        include: { sourceConcept: true },
        orderBy: { sourceConcept: { createdAt: 'desc' } },
      }),
    ])

    const seen = new Set<string>()
    const concepts: Array<{ id: string; content: string; sourceType: string; status: string; createdAt: Date; link: 'profile' | 'post' }> = []
    for (const src of [...directSources, ...postSources]) {
      if (seen.has(src.sourceConcept.id)) continue
      seen.add(src.sourceConcept.id)
      concepts.push({
        id: src.sourceConcept.id,
        content: src.sourceConcept.content,
        sourceType: src.sourceConcept.sourceType,
        status: src.sourceConcept.status,
        createdAt: src.sourceConcept.createdAt,
        link: src.socialProfileId ? 'profile' : 'post',
      })
    }
    return concepts
  }

  async listForPost(postId: string) {
    const sources = await this.prisma.sourceConceptSource.findMany({
      where: { postId },
      include: { sourceConcept: true },
      orderBy: { sourceConcept: { createdAt: 'desc' } },
    })
    return sources.map((s) => ({
      id: s.sourceConcept.id,
      content: s.sourceConcept.content,
      sourceType: s.sourceConcept.sourceType,
      status: s.sourceConcept.status,
      createdAt: s.sourceConcept.createdAt,
      link: 'post' as const,
    }))
  }

  async markConsumed(id: string) {
    const concept = await this.prisma.sourceConcept.findUnique({ where: { id } })
    if (!concept) throw new NotFoundException('SourceConcept not found')
    return this.prisma.sourceConcept.update({
      where: { id },
      data: { status: 'consumed', consumedAt: new Date() },
    })
  }

  // Retroactively generate source concepts for INSPO posts that already have a
  // postSynthesis but no SourceConceptSource linking them (i.e. processed before Phase 4).
  async generateRetroactiveForBrand(brandId: string): Promise<{ generated: number }> {
    const brand = await this.prisma.brand.findUnique({ where: { id: brandId } })
    if (!brand) throw new NotFoundException('Brand not found')

    // All INSPO post memberships for this brand where post has synthesis
    const memberships = await this.prisma.categoryMembership.findMany({
      where: { brandId, category: 'INSPO', isActive: true, postId: { not: null } },
      include: { post: { select: { id: true, caption: true, postSynthesis: true } } },
    })

    // Exclude posts already linked to a SourceConceptSource
    const linkedPostIds = await this.prisma.sourceConceptSource
      .findMany({ where: { postId: { not: null } }, select: { postId: true } })
      .then((rows) => new Set(rows.map((r) => r.postId)))

    const unprocessed = memberships.filter(
      (m) => m.post?.postSynthesis && !linkedPostIds.has(m.postId),
    )

    if (unprocessed.length === 0) return { generated: 0 }

    const { client, model } = getClientForFeature('synthesis')
    let generated = 0

    // Process in batches of 10 to avoid overwhelming the LLM
    for (let i = 0; i < unprocessed.length; i += 10) {
      const batch = unprocessed.slice(i, i + 10)
      await Promise.all(
        batch.map(async (m) => {
          const post = m.post!
          const contentBlock = [
            post.postSynthesis && `Synthesis: ${post.postSynthesis}`,
            post.caption && `Caption: ${post.caption}`,
          ].filter(Boolean).join('\n')

          try {
            const result = await client.chatCompletion({
              model,
              temperature: 0.4,
              messages: [
                {
                  role: 'system',
                  content: `You are a content strategist. Given a social media post synthesis (and optional caption), extract 1-3 distinct source concepts (each 30-60 words) that could independently drive a separate content ideation batch. Each concept must be self-contained and actionable.
Return JSON: { "sourceConcepts": ["...", "..."] }`,
                },
                { role: 'user', content: contentBlock },
              ],
              responseFormat: { type: 'json_object' },
            })

            const parsed = JSON.parse(result.content) as { sourceConcepts?: unknown[] }
            const concepts = Array.isArray(parsed.sourceConcepts)
              ? parsed.sourceConcepts.filter((c): c is string => typeof c === 'string')
              : []

            await Promise.all(
              concepts.map(async (content) => {
                const concept = await this.prisma.sourceConcept.create({
                  data: { brandId, content, sourceType: 'specific_post', status: 'pending' },
                })
                await this.prisma.sourceConceptSource.create({
                  data: { sourceConceptId: concept.id, postId: post.id },
                })
                generated++
              }),
            )
          } catch {
            // Non-fatal: skip individual post failures
          }
        }),
      )
    }

    return { generated }
  }

  // ── Dispatch a concept from a specific InspoBase item to flownau ideation ──

  async dispatchFromItem(
    brandId: string,
    itemType: 'post' | 'profile' | 'voicenote' | 'youtube' | 'blog',
    itemId: string,
  ): Promise<{ dispatched: boolean; conceptId: string }> {
    const flownauUrl = this.config.get<string>('FLOWNAU_URL')
    const authSecret = this.config.get<string>('AUTH_SECRET')
    if (!flownauUrl || !authSecret) throw new Error('FLOWNAU_URL or AUTH_SECRET not configured')

    const concept = await this.resolveOrCreateConcept(brandId, itemType, itemId)
    if (!concept) throw new NotFoundException(`No source concept available for this ${itemType}`)

    const { signServiceToken } = await import('@nau/auth')
    const axios = (await import('axios')).default
    const token = await signServiceToken({ secret: authSecret, iss: 'nauthenticity', aud: 'flownau' })

    await axios.post(
      `${flownauUrl}/api/v1/_service/ideation`,
      { brandId, topic: concept.content, sourceRef: concept.id },
      { headers: { Authorization: `Bearer ${token}` }, timeout: 120_000 },
    )

    await this.prisma.sourceConcept.update({
      where: { id: concept.id },
      data: { status: 'consumed', consumedAt: new Date() },
    })

    return { dispatched: true, conceptId: concept.id }
  }

  private async resolveOrCreateConcept(
    brandId: string,
    itemType: 'post' | 'profile' | 'voicenote' | 'youtube' | 'blog',
    itemId: string,
  ) {
    // Try existing pending concept linked to this item first
    const existing = await this.findPendingConceptForItem(itemType, itemId)
    if (existing) return existing

    // For types that store a synthesis, create a transient concept on the fly
    if (itemType === 'post') {
      const post = await this.prisma.post.findUnique({ where: { id: itemId }, select: { postSynthesis: true, caption: true } })
      const content = post?.postSynthesis ?? post?.caption
      if (!content) return null
      const concept = await this.prisma.sourceConcept.create({
        data: { brandId, content, sourceType: 'specific_post', status: 'pending' },
      })
      await this.prisma.sourceConceptSource.create({ data: { sourceConceptId: concept.id, postId: itemId } })
      return concept
    }

    if (itemType === 'voicenote') {
      const v = await this.prisma.voicenote.findUnique({ where: { id: itemId }, select: { synthesis: true } })
      if (!v?.synthesis) return null
      const concept = await this.prisma.sourceConcept.create({
        data: { brandId, content: v.synthesis, sourceType: 'voicenote', status: 'pending' },
      })
      return concept
    }

    if (itemType === 'youtube') {
      const video = await this.prisma.youtubeVideo.findUnique({ where: { id: itemId }, select: { synthesis: true } })
      if (!video?.synthesis) return null
      return this.prisma.sourceConcept.create({
        data: { brandId, content: video.synthesis, sourceType: 'inspo_base', status: 'pending' },
      })
    }

    if (itemType === 'blog') {
      const post = await this.prisma.blogPost.findUnique({ where: { id: itemId }, select: { synthesis: true, title: true } })
      const content = post?.synthesis ?? post?.title
      if (!content) return null
      return this.prisma.sourceConcept.create({
        data: { brandId, content, sourceType: 'inspo_base', status: 'pending' },
      })
    }

    // profile — only use an existing concept, never generate on the fly
    return null
  }

  private async findPendingConceptForItem(
    itemType: 'post' | 'profile' | 'voicenote' | 'youtube' | 'blog',
    itemId: string,
  ) {
    if (itemType === 'post') {
      const src = await this.prisma.sourceConceptSource.findFirst({
        where: { postId: itemId, sourceConcept: { status: 'pending' } },
        include: { sourceConcept: true },
        orderBy: { sourceConcept: { createdAt: 'asc' } },
      })
      return src?.sourceConcept ?? null
    }
    if (itemType === 'profile') {
      const src = await this.prisma.sourceConceptSource.findFirst({
        where: { socialProfileId: itemId, sourceConcept: { status: 'pending' } },
        include: { sourceConcept: true },
        orderBy: { sourceConcept: { createdAt: 'asc' } },
      })
      return src?.sourceConcept ?? null
    }
    if (itemType === 'voicenote') {
      const voicenote = await this.prisma.voicenote.findUnique({ where: { id: itemId }, select: { brandId: true, synthesis: true } })
      if (!voicenote) return null
      return this.prisma.sourceConcept.findFirst({
        where: { brandId: voicenote.brandId, sourceType: 'voicenote', status: 'pending', content: voicenote.synthesis },
      })
    }
    // youtube and blog don't link via SourceConceptSource — always create fresh
    return null
  }
}

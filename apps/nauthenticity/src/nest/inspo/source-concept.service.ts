import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { getClientForFeature, reportUsage } from '@nau/llm-client'
import { ConfigService } from '@nestjs/config'
import { Prisma } from '../../../../node_modules/.prisma/client'
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

    // Random selection: up to 20 random INSPO post memberships excluding already-selected
    const randomMemberships: Array<{ postId: string; postSynthesis: string | null; caption: string | null }> =
      recentPostIds.size > 0
        ? await this.prisma.$queryRaw<Array<{ postId: string; postSynthesis: string | null; caption: string | null }>>`
            SELECT cm."postId", p."postSynthesis", p.caption
            FROM "CategoryMembership" cm
            JOIN "Post" p ON p.id = cm."postId"
            WHERE cm."brandId" = ${brandId}
              AND cm.category = 'INSPO'
              AND cm."isActive" = true
              AND cm."postId" IS NOT NULL
              AND cm."postId" NOT IN (${Prisma.join(Array.from(recentPostIds) as string[])})
            ORDER BY RANDOM()
            LIMIT 20
          `
        : await this.prisma.$queryRaw<Array<{ postId: string; postSynthesis: string | null; caption: string | null }>>`
            SELECT cm."postId", p."postSynthesis", p.caption
            FROM "CategoryMembership" cm
            JOIN "Post" p ON p.id = cm."postId"
            WHERE cm."brandId" = ${brandId}
              AND cm.category = 'INSPO'
              AND cm."isActive" = true
              AND cm."postId" IS NOT NULL
            ORDER BY RANDOM()
            LIMIT 20
          `

    const profileMemberships = await this.prisma.categoryMembership.findMany({
      where: { brandId, category: 'INSPO', isActive: true, socialProfileId: { not: null } },
      include: {
        socialProfile: {
          select: { username: true, profileSynthesis: { select: { content: true } } },
        },
      },
      take: 20,
    })

    const totalItems = recentMemberships.length + randomMemberships.length + profileMemberships.length
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
      const text = m.postSynthesis ?? m.caption
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

    const systemPrompt = `You are a creative content strategist. You receive a brand's InspoBase — a curated collection of inspiring posts and profiles — and you extract distinct, actionable source concepts from it as a whole.

A source concept is a rich, self-contained angle or topic that can drive a separate batch of content ideas. Each concept must be distinct: no overlap, no repetition.

Generate as many source concepts as genuinely capture distinct angles from this InspoBase — be moderate, quality over quantity.

Return JSON: { "concepts": [ { "content": "..." }, ... ] }
Each "content" is a paragraph (30–60 words) describing the concept clearly enough for an ideation LLM to work from it independently.`

    const userMessage = `## INSPOBASE\n${inspoLines.join('\n\n')}\n\nExtract source concepts.`

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
}

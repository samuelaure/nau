import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import { getClientForFeature, reportUsage } from '@nau/llm-client'
import { estimateCostUsd } from '@nau/config'
import { z } from 'zod'
import axios from 'axios'

// ── Output schema (matches flownau BrandContext shape) ────────────────────────

const BrandContextSchema = z.object({
  identity: z.object({
    name: z.string().optional(),
    oneLiner: z.string().optional(),
    niche: z.string().optional(),
  }).optional(),
  audience: z.object({
    description: z.string().optional(),
    pains: z.array(z.string()).optional(),
    aspirations: z.array(z.string()).optional(),
  }).optional(),
  pillars: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
  })).optional(),
  voice: z.object({
    descriptors: z.array(z.string()).optional(),
    register: z.enum(['casual', 'mixed', 'professional']).optional(),
    energy: z.enum(['calm', 'measured', 'high']).optional(),
    pov: z.enum(['first-person', 'second-person', 'third-person']).optional(),
  }).optional(),
  doDont: z.object({
    do: z.array(z.string()).optional(),
    dont: z.array(z.string()).optional(),
  }).optional(),
  positioning: z.object({
    pov: z.string().optional(),
    contrasts: z.array(z.string()).optional(),
  }).optional(),
})

export type BrandContextShape = z.infer<typeof BrandContextSchema>

function renderToPlainText(ctx: BrandContextShape): string {
  const lines: string[] = []

  if (ctx.identity?.oneLiner) lines.push(`About: ${ctx.identity.oneLiner}`)
  if (ctx.identity?.niche) lines.push(`Niche: ${ctx.identity.niche}`)

  if (ctx.audience?.description) lines.push(`Audience: ${ctx.audience.description}`)
  if (ctx.audience?.pains?.length) lines.push(`Audience pains: ${ctx.audience.pains.join('; ')}`)
  if (ctx.audience?.aspirations?.length) lines.push(`Audience aspirations: ${ctx.audience.aspirations.join('; ')}`)

  if (ctx.pillars?.length) {
    const list = ctx.pillars.map(p => p.description ? `${p.name} (${p.description})` : p.name).join('; ')
    lines.push(`Content pillars: ${list}`)
  }

  if (ctx.voice) {
    const bits: string[] = []
    if (ctx.voice.descriptors?.length) bits.push(ctx.voice.descriptors.join(', '))
    if (ctx.voice.register) bits.push(`register: ${ctx.voice.register}`)
    if (ctx.voice.energy) bits.push(`energy: ${ctx.voice.energy}`)
    if (ctx.voice.pov) bits.push(`POV: ${ctx.voice.pov}`)
    if (bits.length) lines.push(`Voice: ${bits.join(' · ')}`)
  }

  if (ctx.doDont?.do?.length) lines.push(`Do: ${ctx.doDont.do.join('; ')}`)
  if (ctx.doDont?.dont?.length) lines.push(`Don't: ${ctx.doDont.dont.join('; ')}`)

  if (ctx.positioning?.pov) lines.push(`POV: ${ctx.positioning.pov}`)
  if (ctx.positioning?.contrasts?.length) lines.push(`Pushes back against: ${ctx.positioning.contrasts.join('; ')}`)

  return lines.join('\n')
}

export interface GenerateSources {
  ownedProfile: boolean
  inspoBase: boolean
  previousContext: boolean
  manual: string | null
}

@Injectable()
export class BrandContextService {
  private readonly logger = new Logger(BrandContextService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getContext(brandId: string) {
    const record = await this.prisma.brandContext.findUnique({ where: { brandId } })
    if (!record?.content) return record

    // Migrate legacy records where content was cast from JSON to TEXT verbatim
    try {
      const parsed = JSON.parse(record.content)
      if (parsed && typeof parsed === 'object') {
        const plain = renderToPlainText(BrandContextSchema.parse(parsed))
        await this.prisma.brandContext.update({ where: { brandId }, data: { content: plain } })
        return { ...record, content: plain }
      }
    } catch {
      // already plain text — no action needed
    }

    return record
  }

  async generateContext(brandId: string, sources: GenerateSources): Promise<void> {
    const existing = await this.prisma.brandContext.findUnique({ where: { brandId } })
    if (existing?.status === 'generating') return

    await this.prisma.brandContext.upsert({
      where: { brandId },
      create: { brandId, status: 'generating', sources: sources as any },
      update: { status: 'generating', sources: sources as any },
    })

    this.runGeneration(brandId, sources).catch((err) => {
      this.logger.error(`[BrandContext] Background generation failed for ${brandId}:`, err)
    })
  }

  async saveContext(brandId: string, content: BrandContextShape | string): Promise<void> {
    const text = typeof content === 'string' ? content : renderToPlainText(content)
    await this.prisma.brandContext.upsert({
      where: { brandId },
      create: { brandId, status: 'ready', content: text, generatedAt: new Date() },
      update: { status: 'ready', content: text, generatedAt: new Date() },
    })
    const record = await this.prisma.brandContext.findUnique({ where: { brandId }, select: { customAdditions: true } })
    void this.pushToFlownau(brandId, text, record?.customAdditions ?? null)
  }

  async saveCustomAdditions(brandId: string, customAdditions: string): Promise<void> {
    const record = await this.prisma.brandContext.upsert({
      where: { brandId },
      create: { brandId, status: 'idle', customAdditions },
      update: { customAdditions },
      select: { content: true },
    })
    void this.pushToFlownau(brandId, record.content ?? null, customAdditions)
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  private async runGeneration(brandId: string, sources: GenerateSources): Promise<void> {
    try {
      const brand = await this.prisma.brand.findUnique({ where: { id: brandId } })
      if (!brand) throw new Error(`Brand ${brandId} not found`)

      // Load sources in parallel
      const [ownedPosts, inspoPosts, previousCtx] = await Promise.all([
        sources.ownedProfile
          ? this.prisma.post.findMany({
              where: { socialProfile: { ownerId: brandId } },
              select: { url: true, caption: true },
              orderBy: { postedAt: 'desc' },
              take: 30,
            })
          : Promise.resolve([]),
        sources.inspoBase
          ? this.prisma.categoryMembership.findMany({
              where: { brandId, category: 'INSPO', postId: { not: null } },
              select: { post: { select: { url: true, caption: true } } },
              orderBy: { createdAt: 'desc' },
              take: 20,
            })
          : Promise.resolve([] as Array<{ post: { url: string | null; caption: string | null } | null }>),
        sources.previousContext
          ? this.prisma.brandContext.findUnique({ where: { brandId }, select: { content: true } })
          : Promise.resolve(null),
      ])

      const inspoPostsForLLM = inspoPosts
        .filter((m): m is { post: { url: string | null; caption: string | null } } => !!m.post)
        .map((m) => ({ url: m.post.url ?? null, caption: m.post.caption ?? null }))

      const brandRecord = await this.prisma.brand.findUnique({ where: { id: brandId }, select: { language: true } })
      const context = await this.callLLM({
        brandId,
        language: brandRecord?.language ?? 'Spanish',
        manual: sources.manual,
        previousContext: previousCtx?.content ?? null,
        ownedPosts,
        inspoPosts: inspoPostsForLLM,
      })

      await this.saveContext(brandId, context)
      this.logger.log(`[BrandContext] Generation complete for brand ${brandId}`)
    } catch (err) {
      this.logger.error(`[BrandContext] Generation failed for brand ${brandId}:`, err)
      await this.prisma.brandContext.update({
        where: { brandId },
        data: { status: 'failed' },
      })
    }
  }

  private async callLLM(args: {
    brandId: string
    language: string
    manual: string | null
    previousContext: string | null
    ownedPosts: { url: string | null; caption: string | null }[]
    inspoPosts: { url: string | null; caption: string | null }[]
  }): Promise<BrandContextShape> {
    const { brandId, language, manual, previousContext, ownedPosts, inspoPosts } = args

    const systemPrompt = `You are a brand strategist building a structured brand context for a content creation system.

Your output is a JSON object describing this brand's identity, audience, voice, content pillars, positioning, and do/don'ts.

Requirements:
- Be specific and concrete — generic observations are useless.
- Every field should reflect real signals from the sources provided.
- Omit sections you have no evidence for — do not fabricate.
- Keep all values concise: strings under 120 characters, arrays under 6 items.
- Write all output in ${language}.

Return ONLY valid JSON matching this shape:
{
  "identity": { "name": string, "oneLiner": string, "niche": string },
  "audience": { "description": string, "pains": string[], "aspirations": string[] },
  "pillars": [{ "name": string, "description": string }],
  "voice": { "descriptors": string[], "register": "casual"|"mixed"|"professional", "energy": "calm"|"measured"|"high", "pov": "first-person"|"second-person"|"third-person" },
  "doDont": { "do": string[], "dont": string[] },
  "positioning": { "pov": string, "contrasts": string[] }
}`

    // Build user content — priority: manual > previous context > owned posts > inspo
    const parts: string[] = []

    if (manual?.trim()) {
      parts.push(`## MANUAL INPUT (highest priority — treat as direct instructions)\n${manual.trim()}`)
    }

    if (previousContext?.trim()) {
      parts.push(`## PREVIOUS BRAND CONTEXT (refine and evolve, don't just repeat)\n${previousContext.trim()}`)
    }

    if (ownedPosts.length > 0) {
      const postsText = ownedPosts
        .map((p, i) => {
          const bits: string[] = [`Post ${i + 1}`]
          if (p.caption) bits.push(`Caption: ${p.caption.slice(0, 300)}`)
          return bits.join('\n')
        })
        .join('\n\n')
      parts.push(`## OWNED PROFILE POSTS (${ownedPosts.length} most recent)\n${postsText}`)
    }

    if (inspoPosts.length > 0) {
      const inspoText = inspoPosts
        .map((p, i) => {
          const bits: string[] = [`Inspo ${i + 1}`]
          if (p.caption) bits.push(`Caption: ${p.caption.slice(0, 300)}`)
          return bits.join('\n')
        })
        .join('\n\n')
      parts.push(`## INSPOBASE (${inspoPosts.length} posts)\n${inspoText}`)
    }

    if (parts.length === 0) {
      parts.push(`Generate a brand context for brand ID "${brandId}". Use only what you can reasonably infer — leave fields empty rather than fabricate.`)
    }

    const userContent = parts.join('\n\n---\n\n')

    const { client, model, provider } = getClientForFeature('synthesis')

    const result = await client.chatCompletion({
      model,
      temperature: 0.4,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      responseFormat: { type: 'json_object' },
    })

    const authSecret = this.config.get<string>('AUTH_SECRET')
    const apiUrl = this.config.get<string>('NAU_API_URL')
    if (authSecret && apiUrl) {
      const { signServiceToken } = await import('@nau/auth')
      signServiceToken({ secret: authSecret, iss: 'nauthenticity', aud: 'api' })
        .then((token) =>
          reportUsage({
            apiUrl,
            serviceToken: token,
            workspaceId: '',
            brandId,
            service: 'nauthenticity',
            operation: 'chat_completion',
            usage: result.usage,
            costUsd: estimateCostUsd(model, result.usage.promptTokens, result.usage.completionTokens),
          }),
        )
        .catch(() => {})
    }

    const parsed = JSON.parse(result.content)
    return BrandContextSchema.parse(parsed)
  }

  private async pushToFlownau(brandId: string, content: string | null, customAdditions: string | null = null): Promise<void> {
    const combined = [content?.trim(), customAdditions?.trim()].filter(Boolean).join('\n\nCustom additions:\n')
    if (!combined) return
    const flownauUrl = this.config.get<string>('FLOWNAU_URL') || 'http://localhost:3003'
    const authSecret = this.config.get<string>('AUTH_SECRET')

    if (!authSecret) {
      this.logger.warn('[BrandContext] AUTH_SECRET not set — skipping flownau push')
      return
    }

    try {
      const { signServiceToken } = await import('@nau/auth')
      const token = await signServiceToken({ secret: authSecret, iss: 'nauthenticity', aud: 'flownau' })

      await axios.patch(
        `${flownauUrl}/api/internal/brands/${brandId}/context`,
        { context: combined },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          timeout: 10_000,
        },
      )

      this.logger.log(`[BrandContext] Pushed context to flownau for brand ${brandId}`)
    } catch (err) {
      this.logger.error(`[BrandContext] Failed to push context to flownau for brand ${brandId}:`, err)
    }
  }
}

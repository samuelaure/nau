import type { Prisma } from '@/generated/prisma'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { generateContentIdeas } from '@/modules/ideation/ideation.service'
import { prisma } from '@/modules/shared/prisma'
import { validateServiceToken, unauthorizedResponse } from '@/modules/shared/nau-auth'
import { signServiceToken } from '@nau/auth'

async function serviceHeaders(): Promise<Record<string, string>> {
  const secret = process.env.AUTH_SECRET!
  const token = await signServiceToken({ iss: 'flownau', aud: 'nauthenticity', secret })
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

async function nauApiHeaders(): Promise<Record<string, string>> {
  const secret = process.env.AUTH_SECRET!
  const token = await signServiceToken({ iss: 'flownau', aud: '9nau-api', secret })
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

export async function POST(request: NextRequest) {
  if (!(await validateServiceToken(request))) return unauthorizedResponse()

  try {
    const body = await request.json()
    const { brandId } = body

    if (!brandId) {
      return NextResponse.json({ error: 'Missing required field: brandId' }, { status: 400 })
    }

    const nauthUrl = process.env.NAUTHENTICITY_URL || 'http://nauthenticity:4000'
    const [nauthHeaders, account] = await Promise.all([
      serviceHeaders(),
      prisma.socialProfile.findFirst({ where: { brandId } }),
    ])

    // Fetch InspoBase memberships (post-level only) from nauthenticity NestJS API.
    // Each membership embeds its post; we use post.caption as the source-concept seed
    // until Priority 3 of source-concepts-and-knowledge-bases redesigns this digest.
    const inspoRes = await fetch(
      `${nauthUrl}/api/v1/_service/brands/${brandId}/inspo`,
      { headers: nauthHeaders },
    )
    const inspoData = (inspoRes.ok ? await inspoRes.json() : []) as Array<{
      id: string
      postId: string | null
      socialProfileId: string | null
      post?: { url: string | null; caption: string | null } | null
    }>

    const inspoPosts = inspoData.filter((m) => m.post && m.post.caption)

    if (inspoPosts.length === 0) {
      return NextResponse.json({ success: true, message: 'No InspoBase posts to process.' })
    }

    const brandName: string = account?.username ?? brandId

    const topic = inspoPosts.map((m) => m.post!.caption).filter(Boolean).join('\n')

    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { language: true },
    })

    const result = await generateContentIdeas({
      topic,
      language: brand?.language ?? 'Spanish',
      recentContent: [],
    })

    // NOTE: Previous flow toggled InspoItem.status='processed' to mark items consumed.
    // The new schema has no per-membership status; the redesigned digest pipeline
    // (Priority 3 of source-concepts-and-knowledge-bases) will replace this entirely.

    // Persist as Post records
    if (account) {
      try {
        const brand2 = await prisma.brand.findUnique({ where: { id: brandId }, select: { autoApproveIdeas: true } })
        const autoApprove = brand2?.autoApproveIdeas ?? false
        const batchId = crypto.randomUUID()
        await prisma.post.createMany({
          data: result.ideas.map((idea) => ({
            brandId: account.id,
            ideaText: idea.concept,
            source: 'automatic',
            status: autoApprove ? 'IDEA_APPROVED' : 'IDEA_PENDING',
            priority: 3,
            generationBatchId: batchId,
            llmTrace: { ideaTrace: result.trace } as unknown as Prisma.InputJsonValue,
          })),
          skipDuplicates: true,
        })
      } catch (e) {
        console.warn('[Ideation Cron] Could not persist Post records', e)
      }
    }

    // Format brief
    const dateStr = new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date())
    let briefMd = `📋 *Brief de Contenido — ${dateStr}*\n_Marca: ${brandName}_\n\n`
    briefMd += `*💡 RESUMEN ESTRATÉGICO*\n${result.briefSummary}\n\n`
    result.ideas.forEach((idea, idx) => {
      briefMd += `*IDEA ${idx + 1}*\n`
      briefMd += `${idea.concept}\n\n`
    })
    briefMd += `_Basado en: ${inspoPosts.length} posts de Inspo Base._`

    // Deliver via Zazŭ
    const zazuUrl = process.env.ZAZU_INTERNAL_URL || 'http://zazu:3000'
    try {
      const zazuHeaders = await nauApiHeaders()
      await fetch(`${zazuUrl}/api/internal/notify`, {
        method: 'POST',
        headers: zazuHeaders,
        body: JSON.stringify({ type: 'content_brief', payload: { brandName, markdown: briefMd } }),
      })
    } catch (e) {
      console.warn('[Ideation] Could not deliver brief via Zazŭ', e)
    }

    // Archive in 9naŭ API
    const nauApiUrl = process.env.NAU_INTERNAL_URL || 'http://9nau-api:3000'
    try {
      const apiHeaders = await nauApiHeaders()
      await fetch(`${nauApiUrl}/_service/journal/summary/direct`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          periodType: 'daily',
          type: 'content_brief',
          synthesis: result.briefSummary,
          summary: briefMd,
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
        }),
      })
    } catch (e) {
      console.warn('[Ideation] Could not archive brief in 9naŭ', e)
    }

    return NextResponse.json({ success: true, ideasGenerated: result.ideas.length })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[Ideation Cron] Error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

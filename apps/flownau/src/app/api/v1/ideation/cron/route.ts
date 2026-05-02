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

    // Fetch inspo items from nauthenticity NestJS API
    const inspoRes = await fetch(
      `${nauthUrl}/api/v1/_service/brands/${brandId}/inspo?status=pending`,
      { headers: nauthHeaders },
    )
    const inspoData = (inspoRes.ok ? await inspoRes.json() : []) as Array<{
      id: string
      type: string
      note?: string
      extractedHook?: string
      extractedTheme?: string
      adaptedScript?: string
    }>

    if (inspoData.length === 0) {
      return NextResponse.json({ success: true, message: 'No pending InspoItems to process.' })
    }

    const brandName: string = account?.username ?? brandId

    // Build topic from inspo items until Origin 3 is fully refactored
    const topicLines = inspoData
      .map((item) => [item.extractedTheme, item.extractedHook, item.note].filter(Boolean).join(' — '))
      .filter(Boolean)
    const topic = topicLines.join('\n')

    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { language: true, ideationCount: true },
    })

    const result = await generateContentIdeas({
      topic,
      language: brand?.language ?? 'Spanish',
      count: brand?.ideationCount ?? 9,
      recentContent: [],
    })

    // Mark inspo items as processed
    await Promise.allSettled(
      inspoData.map((item) =>
        fetch(`${nauthUrl}/api/v1/_service/brands/${brandId}/inspo/${item.id}`, {
          method: 'PATCH',
          headers: nauthHeaders,
          body: JSON.stringify({ status: 'processed' }),
        }),
      ),
    )

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
    briefMd += `_Basado en: ${inspoData.length} posts de Inspo Base._`

    // Deliver via Zazŭ
    const zazuUrl = process.env.ZAZU_INTERNAL_URL || 'http://zazu-bot:3000'
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

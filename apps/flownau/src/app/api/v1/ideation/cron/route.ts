import type { Prisma } from '@/generated/prisma'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { generateContentIdeas } from '@/modules/ideation/ideation.service'
import { fetchPendingSourceConcepts, markSourceConceptConsumed } from '@/modules/ideation/sources/inspo-source'
import { prisma } from '@/modules/shared/prisma'
import { validateServiceToken, unauthorizedResponse } from '@/modules/shared/nau-auth'
import { signServiceToken } from '@nau/auth'

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

    const account = await prisma.socialProfile.findFirst({ where: { brandId } })

    // Fetch source concepts — pool-first, auto-generates if pool is empty
    const sourceConcepts = await fetchPendingSourceConcepts(brandId)

    if (sourceConcepts.length === 0) {
      return NextResponse.json({ success: true, message: 'No source concepts available.' })
    }

    // Use up to 5 concepts per ideation run
    const batch = sourceConcepts.slice(0, 5)
    const brandName: string = account?.username ?? brandId
    const topic = batch.map((c) => c.content).join('\n\n')

    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { language: true },
    })

    const result = await generateContentIdeas({
      topic,
      language: brand?.language ?? 'Spanish',
      recentContent: [],
    })

    // Mark all concepts in this batch as consumed
    await Promise.all(batch.map((c) => markSourceConceptConsumed(c.id)))

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
    briefMd += `_Basado en: ${batch.length} conceptos de fuente._`

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

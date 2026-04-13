import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { composeVideoWithAgent } from '@/modules/video/agent'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max for AI generation timeout

export async function GET() {
  try {
    const results = []

    // 1. Find all APPROVED content ideas that haven't been used yet
    const approvedIdeas = await prisma.contentIdea.findMany({
      where: { status: 'APPROVED' },
      include: { account: true },
      take: 20, // Process a batch
    })

    for (const idea of approvedIdeas) {
      if (!idea.account) continue

      // Look up persona to see if it allows auto approval of generated compositions
      const persona = await prisma.brandPersona.findFirst({
        where: { accountId: idea.accountId, isDefault: true },
      })

      try {
        // 2. Data-driven content generation: Idea -> Composition Schema
        const { composition, templateId } = await composeVideoWithAgent(
          idea.ideaText,
          idea.accountId,
          'reel',
          undefined, // Let the agent pick the best template
          persona?.id,
        )

        // 3. Save Composition
        const isAutoApprove = persona?.autoApproveCompositions ?? false

        await prisma.composition.create({
          data: {
            accountId: idea.accountId,
            templateId: templateId,
            payload: composition as any,
            caption: (composition as any).caption || '',
            status: isAutoApprove ? 'APPROVED' : 'DRAFT',
          },
        })

        // 4. Mark idea as USED
        await prisma.contentIdea.update({
          where: { id: idea.id },
          data: { status: 'USED' },
        })

        results.push({
          ideaId: idea.id,
          accountId: idea.accountId,
          status: 'success',
          action: isAutoApprove ? 'Generated & Approved' : 'Generated as Draft',
        })
      } catch (err: any) {
        console.error(`[CRON_GENERATOR_ERROR] Idea ${idea.id}:`, err)
        results.push({ ideaId: idea.id, status: 'failed', error: err.message })
      }
    }

    return NextResponse.json({ message: 'Generator Execution Finished', results })
  } catch (error: any) {
    console.error('[CRON_GENERATOR_FATAL]', error)
    return NextResponse.json(
      { error: 'Fatal generator failure', details: error.message },
      { status: 500 },
    )
  }
}

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { generateContentIdeas } from '@/modules/ideation/ideation.service'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max for AI generation timeout

/**
 * GET /api/cron/ideation
 * Runs periodically to generate new content ideas using the ideation service.
 */
export async function GET() {
  try {
    const results = []

    // 1. Fetch eligible accounts (ones with default BrandPersona and missing pending ideas)
    const accounts = await prisma.socialAccount.findMany({
      take: 10, // process batches
    })

    for (const account of accounts) {
      // Find the active brand persona
      const persona = await prisma.brandPersona.findFirst({
        where: { accountId: account.id, isDefault: true },
      })

      if (!persona) continue

      // See how many pending ideas this account has
      const pendingIdeasCount = await prisma.contentIdea.count({
        where: { accountId: account.id, status: 'PENDING' },
      })

      // Skip if they already have plenty of pending ideas
      if (pendingIdeasCount >= 10) continue

      try {
        // Generate new ideas via the Ideation Engine.
        // Nauthenticity integration (inspoItems) is planned for Phase 5.
        // For now, generate purely based on Brand DNA.
        const output = await generateContentIdeas({
          brandName: persona.name,
          brandDNA: persona.systemPrompt,
          inspoItems: [],
        })

        // Insert generated ideas
        for (const idea of output.ideas) {
          const ideaText = `[${idea.format.toUpperCase()}] Hook: ${idea.hook}\nAngle: ${idea.angle}\nScript: ${idea.script}\nCTA: ${idea.cta}`

          await prisma.contentIdea.create({
            data: {
              accountId: account.id,
              ideaText,
              status: persona.autoApproveIdeas ? 'APPROVED' : 'PENDING',
              source: 'internal', // standard internal generation
            },
          })
        }

        results.push({
          accountId: account.id,
          status: 'success',
          ideasGenerated: output.ideas.length,
          summary: output.briefSummary,
        })
      } catch (err: any) {
        console.error(`[CRON_IDEATION_ERROR] Account ${account.id}:`, err)
        results.push({ accountId: account.id, status: 'failed', error: err.message })
      }
    }

    return NextResponse.json({ message: 'Ideation Execution Finished', results })
  } catch (error: any) {
    console.error('[CRON_IDEATION_FATAL]', error)
    return NextResponse.json(
      { error: 'Fatal ideation failure', details: error.message },
      { status: 500 },
    )
  }
}

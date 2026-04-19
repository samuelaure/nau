import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { publishComposition } from '@/modules/publisher/publish-orchestrator'
import { scheduleRenderedCompositions } from '@/modules/publisher/scheduler'
import { logError } from '@/modules/shared/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 120 // 2 minutes — publishing only, no rendering

/**
 * GET /api/cron/publisher
 *
 * Publish rendered compositions to Instagram via the unified orchestrator.
 * This cron ONLY handles Instagram API calls — rendering is fully decoupled
 * to the dedicated render worker (BullMQ queue).
 *
 * Part A: Explicitly scheduled compositions (scheduledAt <= now, status = rendered)
 * Part B: Auto-posted compositions via PostingSchedule
 */
import { validateCronSecret, unauthorizedCronResponse } from '@/modules/shared/nau-auth'

export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return unauthorizedCronResponse()
  }

  try {
    const results: Array<{
      type: string
      compositionId?: string
      accountId?: string
      status: string
      error?: string
    }> = []
    const now = new Date()

    // --- PART A: Assign Scheduled Times ---
    // This correctly distributes unscheduled, rendered compositions into future time-of-day slots
    await scheduleRenderedCompositions()

    // --- PART B: Publish Due Compositions ---
    // Finds RENDERED compositions whose scheduledAt has arrived.
    // Phase 17: only auto-publish if the account's default persona has autoApprovePost=true.
    // If false, the composition waits for manual approval via the Final Review UI.
    const explicitCompositions = await prisma.composition.findMany({
      where: {
        status: { in: ['RENDERED', 'rendered', 'PUBLISHING'] },
        scheduledAt: { lte: now },
        publishAttempts: { lt: 3 },
      },
      include: {
        account: {
          include: {
            brandPersonas: {
              where: { isDefault: true },
              take: 1,
            },
          },
        },
      },
    })

    for (const composition of explicitCompositions) {
      if (
        !composition.account ||
        !composition.account.accessToken ||
        !composition.account.platformId
      ) {
        continue
      }

      // Phase 17 gate: skip if autoApprovePost is off and not already PUBLISHING (manual approval)
      const defaultPersona = composition.account.brandPersonas?.[0]
      const autoApprovePost = defaultPersona?.autoApprovePost ?? false
      if (!autoApprovePost && composition.status !== 'PUBLISHING') {
        continue
      }
      try {
        const result = await publishComposition(composition)
        if (result.success) {
          // ALSO update the PostingSchedule lastPostedAt if it exists
          await prisma.postingSchedule.updateMany({
            where: { accountId: composition.accountId },
            data: { lastPostedAt: now },
          })
          results.push({ type: 'explicit', compositionId: composition.id, status: 'success' })
        } else {
          throw new Error(result.error || 'Unknown publish error')
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err)
        logError(`[Publisher] Publish failed for ${composition.id}`, err)
        const attempts = composition.publishAttempts + 1
        await prisma.composition.update({
          where: { id: composition.id },
          data: {
            publishAttempts: attempts,
            lastPublishError: errMsg,
            status: attempts >= 3 ? 'failed' : composition.status,
          },
        })
        results.push({
          type: 'explicit',
          compositionId: composition.id,
          status: 'failed',
          error: errMsg,
        })
      }
    }

    return NextResponse.json({ message: 'Publisher Execution Finished', results })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    logError('[Publisher] Fatal error', error)
    return NextResponse.json({ error: 'Fatal publisher failure', details: msg }, { status: 500 })
  }
}

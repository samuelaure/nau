import { prisma } from '@/modules/shared/prisma'
import { logger } from '@/modules/shared/logger'
import { runPlannerStrategist } from '@/modules/scheduling/planner-strategist'

/**
 * Phase 18: AI planner-strategist orders APPROVED compositions, then a
 * rule-based slot calculator assigns each to the next matching HH:MM slot
 * from the account's default ContentPlanner.
 *
 * Gate: ContentPlanner.autoApproveSchedule
 *   true  → composition moves to SCHEDULED (authorises advance rendering)
 *   false → composition keeps APPROVED status but receives a scheduledAt suggestion
 */
export async function runAutonomousScheduler(): Promise<{
  slotted: number
  autoScheduled: number
}> {
  const planners = await prisma.contentPlanner.findMany({
    where: { isDefault: true },
    include: { account: true },
  })

  let slotted = 0
  let autoScheduled = 0
  const now = new Date()

  for (const planner of planners) {
    if (!planner.account) continue

    const postingTimes: string[] = Array.isArray(planner.postingTimes)
      ? (planner.postingTimes as string[])
      : JSON.parse((planner.postingTimes as string) || '[]')

    const trialPostingTimes: string[] = Array.isArray(planner.trialPostingTimes)
      ? (planner.trialPostingTimes as string[])
      : JSON.parse((planner.trialPostingTimes as string) || '[]')

    const hasSlots = postingTimes.length > 0 || trialPostingTimes.length > 0
    if (!hasSlots) continue

    const autoApprove = planner.autoApproveSchedule

    const approved = await prisma.composition.findMany({
      where: {
        accountId: planner.account.id,
        status: 'APPROVED',
        scheduledAt: null,
      },
      select: { id: true, format: true, ideaId: true },
      orderBy: { createdAt: 'asc' },
    })

    if (approved.length === 0) continue

    // Fetch idea text for the AI strategist (minimal payload — token-economic)
    const ideaIds = approved.map((c) => c.ideaId).filter(Boolean) as string[]
    const ideas = await prisma.contentIdea.findMany({
      where: { id: { in: ideaIds } },
      select: { id: true, ideaText: true },
    })
    const ideaTextMap = new Map(ideas.map((i) => [i.id, i.ideaText]))

    const pieces = approved.map((c) => ({
      id: c.id,
      format: c.format,
      ideaText: c.ideaId ? (ideaTextMap.get(c.ideaId) ?? '') : '',
    }))

    // AI strategist: returns ordered composition IDs
    let orderedIds = pieces.map((p) => p.id)
    if (planner.strategistPrompt) {
      orderedIds = await runPlannerStrategist({
        strategistPrompt: planner.strategistPrompt,
        pieces,
        reelsPerDay: planner.reelsPerDay,
        trialReelsPerDay: planner.trialReelsPerDay,
        daysToPlan: planner.daysToPlan,
      })
    }

    // Rebuild ordered list (AI may reorder)
    const compositionMap = new Map(approved.map((c) => [c.id, c]))
    const orderedComps = orderedIds
      .map((id) => compositionMap.get(id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c))

    // Baseline: latest already-assigned slot in the future, or now
    const latestSlotted = await prisma.composition.findFirst({
      where: {
        accountId: planner.account.id,
        scheduledAt: { not: null },
        status: { in: ['APPROVED', 'SCHEDULED', 'RENDERING', 'RENDERED', 'PUBLISHING'] },
      },
      orderBy: { scheduledAt: 'desc' },
      select: { scheduledAt: true },
    })

    const baseline =
      latestSlotted?.scheduledAt && latestSlotted.scheduledAt > now
        ? new Date(latestSlotted.scheduledAt)
        : new Date(now)

    for (const comp of orderedComps) {
      const timesToUse = comp.format === 'trial_reel' ? trialPostingTimes : postingTimes
      if (timesToUse.length === 0) continue

      const nextSlot = calculateNextSlot(baseline, timesToUse, planner.timezone)

      await prisma.composition.update({
        where: { id: comp.id },
        data: {
          scheduledAt: nextSlot,
          status: autoApprove ? 'SCHEDULED' : 'APPROVED',
        },
      })

      baseline.setTime(nextSlot.getTime())
      slotted++
      if (autoApprove) autoScheduled++
    }

    logger.info(
      `[Scheduler] ${planner.account.id}: slotted ${orderedComps.length} compositions (autoApprove=${autoApprove}, strategist=${Boolean(planner.strategistPrompt)})`,
    )
  }

  return { slotted, autoScheduled }
}

function calculateNextSlot(afterDate: Date, timeSlots: string[], timezone: string): Date {
  const sortedSlots = [...timeSlots].sort()

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour12: false,
  })

  let daysOffset = 0

  while (true) {
    const candidateDate = new Date(afterDate)
    candidateDate.setUTCDate(candidateDate.getUTCDate() + daysOffset)

    const parts = formatter.formatToParts(candidateDate)
    const map = Object.fromEntries(parts.map((p) => [p.type, p.value]))

    for (const slot of sortedSlots) {
      const [hours, minutes] = slot.split(':').map(Number)
      const localWallTimeStr = `${map.year}-${map.month}-${map.day}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`
      const localDate = new Date(localWallTimeStr + 'Z')

      const testFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: 'longOffset',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })
      const testParts = testFormatter.formatToParts(localDate)
      const offsetPart = testParts.find((p) => p.type === 'timeZoneName')?.value || 'GMT'
      const sign = offsetPart.includes('+') ? 1 : -1
      const match = offsetPart.match(/(\d{2}):(\d{2})/)
      const offsetMs = match ? sign * (parseInt(match[1]) * 60 + parseInt(match[2])) * 60 * 1000 : 0

      const exactUtcDate = new Date(localDate.getTime() - offsetMs)
      if (exactUtcDate > afterDate) return exactUtcDate
    }

    daysOffset++
  }
}

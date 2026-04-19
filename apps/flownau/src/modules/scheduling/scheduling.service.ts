import { prisma } from '@/modules/shared/prisma'
import { logger } from '@/modules/shared/logger'

/**
 * Scans for APPROVED compositions and assigns them to next matching PostingSchedule slots.
 * If the account's default persona has autoApproveSchedule=true, moves them to SCHEDULED.
 * Otherwise, they retain APPROVED status but receive a `scheduledAt` (suggested slot).
 */
export async function runAutonomousScheduler(): Promise<{
  slotted: number
  autoScheduled: number
}> {
  const schedules = await prisma.postingSchedule.findMany({
    include: { account: true },
  })

  let slotted = 0
  let autoScheduled = 0
  const now = new Date()

  for (const schedule of schedules) {
    if (!schedule.account) continue

    const postingTimes: string[] = Array.isArray(schedule.postingTimes)
      ? (schedule.postingTimes as string[])
      : JSON.parse((schedule.postingTimes as string) || '[]')

    const trialPostingTimes: string[] = Array.isArray(schedule.trialPostingTimes)
      ? (schedule.trialPostingTimes as string[])
      : JSON.parse((schedule.trialPostingTimes as string) || '[]')

    const hasSlots = postingTimes.length > 0 || trialPostingTimes.length > 0
    if (!hasSlots) continue

    // Resolve autoApproveSchedule from default persona
    const persona = await prisma.brandPersona.findFirst({
      where: { accountId: schedule.accountId, isDefault: true },
    })
    const autoApprove = persona?.autoApproveSchedule ?? false

    // Find APPROVED compositions without a scheduled slot
    const approved = await prisma.composition.findMany({
      where: {
        accountId: schedule.accountId,
        status: 'APPROVED',
        scheduledAt: null,
      },
      orderBy: { createdAt: 'asc' },
    })

    if (approved.length === 0) continue

    // Baseline: latest already-assigned slot in the future, or now
    const latestSlotted = await prisma.composition.findFirst({
      where: {
        accountId: schedule.accountId,
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

    for (const comp of approved) {
      const timesToUse = comp.format === 'trial_reel' ? trialPostingTimes : postingTimes
      if (timesToUse.length === 0) continue

      const nextSlot = calculateNextSlot(baseline, timesToUse, schedule.timezone)

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
      `[Scheduler] ${schedule.accountId}: slotted ${approved.length} compositions (autoApprove=${autoApprove})`,
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

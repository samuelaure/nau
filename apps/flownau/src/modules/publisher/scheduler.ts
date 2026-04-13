import { prisma } from '@/modules/shared/prisma'
import { logger } from '@/modules/shared/logger'

/**
 * Assigns `scheduledAt` timestamps to rendered compositions that lack one,
 * spacing them out based on the account's PostingSchedule slots.
 */
export async function scheduleRenderedCompositions() {
  const schedules = await prisma.postingSchedule.findMany({
    include: { account: true },
  })

  let totalScheduled = 0
  const now = new Date()

  for (const schedule of schedules) {
    if (!schedule.account) continue

    // Parse posting times arrays (defaulting to empty array)
    const postingTimes: string[] = Array.isArray(schedule.postingTimes)
      ? schedule.postingTimes
      : JSON.parse((schedule.postingTimes as string) || '[]')

    const trialPostingTimes: string[] = Array.isArray(schedule.trialPostingTimes)
      ? schedule.trialPostingTimes
      : JSON.parse((schedule.trialPostingTimes as string) || '[]')

    const hasSlots = postingTimes.length > 0 || trialPostingTimes.length > 0
    if (!hasSlots) continue

    // Find unscheduled, rendered compositions
    const unscheduledComps = await prisma.composition.findMany({
      where: {
        accountId: schedule.accountId,
        status: 'rendered',
        scheduledAt: null,
      },
      orderBy: { createdAt: 'asc' },
    })

    if (unscheduledComps.length === 0) continue

    // We'll calculate future slots starting from today.
    // To ensure we don't double-book, we find the latest scheduled composition
    const latestScheduledInfo = await prisma.composition.findFirst({
      where: {
        accountId: schedule.accountId,
        scheduledAt: { not: null },
      },
      orderBy: { scheduledAt: 'desc' },
      select: { scheduledAt: true },
    })

    const baselineDate =
      latestScheduledInfo?.scheduledAt && latestScheduledInfo.scheduledAt > now
        ? latestScheduledInfo.scheduledAt
        : now

    for (const comp of unscheduledComps) {
      const timesToUse = comp.format === 'trial_reel' ? trialPostingTimes : postingTimes

      if (timesToUse.length === 0) continue

      const nextSlot = calculateNextSlot(baselineDate, timesToUse, schedule.timezone)

      await prisma.composition.update({
        where: { id: comp.id },
        data: {
          status: 'scheduled',
          scheduledAt: nextSlot,
        },
      })

      // Update baseline for the next composition
      baselineDate.setTime(nextSlot.getTime())
      totalScheduled++
    }

    if (unscheduledComps.length > 0) {
      logger.info(
        `[Scheduler] Scheduled ${totalScheduled} compositions for account ${schedule.accountId}`,
      )
    }
  }

  return totalScheduled
}

/**
 * Calculates the next available future Date object matching one of the HH:MM slots
 * in the given timezone, strictly after the `afterDate`.
 */
function calculateNextSlot(afterDate: Date, timeSlots: string[], timezone: string): Date {
  const sortedSlots = [...timeSlots].sort()

  // Create a formatter for the target timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  let daysOffset = 0

  while (true) {
    const candidateDate = new Date(afterDate)
    candidateDate.setUTCDate(candidateDate.getUTCDate() + daysOffset)

    // Get the local date string in the target timezone for the candidate day
    const parts = formatter.formatToParts(candidateDate)
    const map = Object.fromEntries(parts.map((p) => [p.type, p.value]))

    for (const slot of sortedSlots) {
      const [hours, minutes] = slot.split(':').map(Number)

      // Parse back to a UTC timestamp assuming the local wall time is `slot`
      // We do this by formatting the base date into an ISO string in local time
      // and asking JS to parse it with the specific offset... wait, JS Date parsing
      // handles timezone shifts poorly unless we use a library or manual offsets.

      // Simpler approach: construct a date string like 'YYYY-MM-DDTHH:mm:00'
      // and use standard timezone logic, but since we are natively in JS without date-fns-tz,
      // we can use a small hack by formatting to UTC and adjusting.

      const localWallTimeStr = `${map.year}-${map.month}-${map.day}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`

      // To get the exact UTC time for `localWallTimeStr` in `timezone`,
      // we can do a binary search or timezone offset approximation.
      // Easiest is to parse as local, test timezone offset, and adjust.
      const localDate = new Date(localWallTimeStr + 'Z') // Treat as UTC initially

      // Find the offset for this exact time
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

      // offsetPart is like "GMT+02:00"
      const sign = offsetPart.includes('+') ? 1 : -1
      const match = offsetPart.match(/(\d{2}):(\d{2})/)
      const offsetMs = match ? sign * (parseInt(match[1]) * 60 + parseInt(match[2])) * 60 * 1000 : 0

      // The exact UTC time
      const exactUtcDate = new Date(localDate.getTime() - offsetMs)

      if (exactUtcDate > afterDate) {
        return exactUtcDate
      }
    }

    daysOffset++
  }
}

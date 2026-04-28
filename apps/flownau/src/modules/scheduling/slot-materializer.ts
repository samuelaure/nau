import { prisma } from '@/modules/shared/prisma'
import { logger } from '@/modules/shared/logger'

/**
 * Materializes PostSlots for a brand from its PostSchedule.
 *
 * Only creates slots that don't already exist (idempotent).
 * Slots are created in UTC from windowStart/windowEnd + timezone offset.
 *
 * @param brandId
 * @param daysAhead  how many days forward to materialize (defaults to coverageHorizonDays + 1)
 * @returns number of new slots created
 */
export async function materializeSlots(brandId: string, daysAhead?: number): Promise<number> {
  const [schedule, brand] = await Promise.all([
    prisma.postSchedule.findUnique({ where: { brandId } }),
    prisma.brand.findUnique({ where: { id: brandId }, select: { coverageHorizonDays: true } }),
  ])

  if (!schedule || !schedule.isActive || schedule.formatChain.length === 0) return 0

  const horizon = daysAhead ?? (brand?.coverageHorizonDays ?? 7) + 1
  const chain = schedule.formatChain
  const freq = Math.max(1, schedule.dailyFrequency)

  // Parse window times — "HH:MM"
  const [startH, startM] = schedule.windowStart.split(':').map(Number)
  const [endH, endM] = schedule.windowEnd.split(':').map(Number)
  const windowStartMins = startH * 60 + startM
  const windowEndMins = endH * 60 + endM

  // Spacing between posts within the day (minutes)
  const spacingMins = freq === 1 ? 0 : (windowEndMins - windowStartMins) / (freq - 1)

  // Find the latest existing slot to avoid duplicating
  const latestSlot = await prisma.postSlot.findFirst({
    where: { brandId },
    orderBy: { scheduledAt: 'desc' },
    select: { scheduledAt: true },
  })

  const startFrom = latestSlot
    ? new Date(latestSlot.scheduledAt.getTime() + 60_000) // 1 min after latest
    : startOfTodayInTimezone(schedule.timezone)

  // Track chain position — start from current chainPosition
  let chainPos = schedule.chainPosition
  let totalSlotIndex = 0
  let created = 0

  const now = new Date()
  const cutoff = new Date(now.getTime() + horizon * 24 * 60 * 60 * 1000)

  // Walk day by day from startFrom
  const dayStart = new Date(startFrom)
  dayStart.setUTCHours(0, 0, 0, 0)

  const slotsToCreate: Array<{ brandId: string; scheduledAt: Date; format: string; status: string }> = []

  while (dayStart < cutoff) {
    for (let i = 0; i < freq; i++) {
      const offsetMins = windowStartMins + i * spacingMins
      const localH = Math.floor(offsetMins / 60)
      const localM = offsetMins % 60

      // Convert local HH:MM in brand timezone to a UTC Date for this calendar day
      const slotTime = localTimeToUTC(dayStart, localH, localM, schedule.timezone)

      if (slotTime < startFrom || slotTime < now) {
        totalSlotIndex++
        chainPos = (schedule.chainPosition + totalSlotIndex) % chain.length
        continue
      }
      if (slotTime >= cutoff) break

      slotsToCreate.push({
        brandId,
        scheduledAt: slotTime,
        format: chain[chainPos],
        status: 'empty',
      })

      totalSlotIndex++
      chainPos = (schedule.chainPosition + totalSlotIndex) % chain.length
    }

    dayStart.setUTCDate(dayStart.getUTCDate() + 1)
  }

  if (slotsToCreate.length > 0) {
    // Filter out any that already exist at exactly those times
    const existingTimes = await prisma.postSlot.findMany({
      where: {
        brandId,
        scheduledAt: { in: slotsToCreate.map((s) => s.scheduledAt) },
      },
      select: { scheduledAt: true },
    })
    const existingSet = new Set(existingTimes.map((s) => s.scheduledAt.toISOString()))
    const newSlots = slotsToCreate.filter((s) => !existingSet.has(s.scheduledAt.toISOString()))

    if (newSlots.length > 0) {
      await prisma.postSlot.createMany({ data: newSlots, skipDuplicates: true })
      created = newSlots.length
      logger.info({ brandId, created, horizon }, '[SLOTS] Materialized slots')
    }
  }

  return created
}

/**
 * Converts a local HH:MM time on a given UTC calendar day to its UTC equivalent.
 *
 * Strategy: start with a candidate where the UTC clock shows those hours/mins,
 * then read back what local time that candidate actually is in the timezone,
 * compute the delta, and correct. Handles DST transitions correctly.
 */
function localTimeToUTC(utcDay: Date, localH: number, localM: number, timezone: string): Date {
  // Candidate: same calendar date, UTC hours = local hours (ignores offset)
  const candidate = new Date(utcDay)
  candidate.setUTCHours(localH, localM, 0, 0)

  try {
    // Read the candidate back in the target timezone
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(candidate)

    const displayH = parseInt(parts.find((p) => p.type === 'hour')?.value ?? String(localH))
    const displayM = parseInt(parts.find((p) => p.type === 'minute')?.value ?? String(localM))

    // Offset = UTC time shown - local time desired; subtract to correct
    const diffMins = displayH * 60 + displayM - (localH * 60 + localM)
    const result = new Date(candidate.getTime() - diffMins * 60_000)
    return result
  } catch {
    return candidate
  }
}

/**
 * Returns midnight UTC for "today" in a given IANA timezone.
 * Falls back to UTC midnight if timezone is invalid.
 */
function startOfTodayInTimezone(timezone: string): Date {
  try {
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    const [year, month, day] = formatter.format(now).split('-').map(Number)
    return new Date(Date.UTC(year, month - 1, day))
  } catch {
    const now = new Date()
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  }
}

/**
 * Advances the chainPosition on a PostSchedule after N slots have been consumed.
 */
export async function advanceChainPosition(brandId: string, slotsConsumed: number): Promise<void> {
  const schedule = await prisma.postSchedule.findUnique({
    where: { brandId },
    select: { chainPosition: true, formatChain: true },
  })
  if (!schedule || schedule.formatChain.length === 0) return

  const newPos = (schedule.chainPosition + slotsConsumed) % schedule.formatChain.length
  await prisma.postSchedule.update({
    where: { brandId },
    data: { chainPosition: newPos },
  })
}

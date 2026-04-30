import { prisma } from '@/modules/shared/prisma'
import { logger } from '@/modules/shared/logger'

/**
 * Materializes PostSlots for a brand from its PostSchedule.
 *
 * Called after schedule settings change (PUT /schedule).
 * The caller is responsible for deleting stale future empty slots first.
 *
 * Algorithm (applied day by day, starting from today in brand timezone):
 *   For each day in the horizon:
 *     1. Count existing slots for that day (any status: empty + filled + published)
 *     2. If count < dailyFrequency → create (dailyFrequency - count) new empty slots
 *        at ideal window times that are:
 *          a) in the future (>= now)
 *          b) not already occupied by an existing slot at that exact UTC timestamp
 *   Never deletes anything.
 *
 * @param brandId
 * @param daysAhead  days forward to materialize (defaults to brand.coverageHorizonDays + 1)
 * @returns number of new slots created
 */
export async function materializeSlots(brandId: string, daysAhead?: number): Promise<number> {
  const [schedule, brand] = await Promise.all([
    prisma.postSchedule.findUnique({ where: { brandId } }),
    prisma.brand.findUnique({ where: { id: brandId }, select: { coverageHorizonDays: true } }),
  ])

  if (!schedule || !schedule.isActive || schedule.formatChain.length === 0) return 0

  const horizon = daysAhead ?? (brand?.coverageHorizonDays ?? 7) + 1

  // Prune empty slots that fall beyond the horizon — keeps the calendar tidy as
  // the horizon rolls forward day by day without needing a schedule re-save.
  const cutoffPrune = new Date(Date.now() + horizon * 24 * 60 * 60 * 1000)
  await prisma.postSlot.deleteMany({
    where: { brandId, status: 'empty', scheduledAt: { gt: cutoffPrune } },
  })
  const chain = schedule.formatChain
  const freq = Math.max(1, schedule.dailyFrequency)

  const now = new Date()
  // Walk from local midnight of today
  const todayLocal = startOfTodayInTimezone(schedule.timezone)
  const cutoff = new Date(todayLocal.getTime() + horizon * 24 * 60 * 60 * 1000)

  // Parse posting window — "HH:MM"
  const [startH, startM] = schedule.windowStart.split(':').map(Number)
  const [endH, endM] = schedule.windowEnd.split(':').map(Number)
  const windowStartMins = startH * 60 + startM
  const windowEndMins = endH * 60 + endM

  // Helper: local YYYY-MM-DD for a UTC instant in the brand timezone
  const toLocalDateStr = (d: Date): string =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: schedule.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d)

  // Helper: current time-of-day in minutes in the brand timezone
  const nowLocalMins = (): number => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: schedule.timezone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(now)
    const h = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0')
    const m = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0')
    return h * 60 + m
  }

  // Helper: compute evenly-spaced slot times for a day given an effective window
  const computeSlotTimes = (day: Date, effStartMins: number, effEndMins: number, count: number): Date[] => {
    const spacing = count <= 1 ? 0 : (effEndMins - effStartMins) / (count - 1)
    return Array.from({ length: count }, (_, i) => {
      const offsetMins = effStartMins + i * spacing
      return localTimeToUTC(day, Math.floor(offsetMins / 60), Math.floor(offsetMins % 60), schedule.timezone)
    })
  }

  // Fetch all existing slots in the window (any status) so we can:
  //   a) count per day (to know how many slots already exist)
  //   b) detect exact UTC time collisions
  const existingSlots = await prisma.postSlot.findMany({
    where: { brandId, scheduledAt: { gte: todayLocal, lt: cutoff } },
    select: { scheduledAt: true },
  })

  // Count of existing slots (any status) per local date
  const countByDate: Record<string, number> = {}
  for (const s of existingSlots) {
    const d = toLocalDateStr(s.scheduledAt)
    countByDate[d] = (countByDate[d] ?? 0) + 1
  }

  // Set of occupied UTC timestamps — used to avoid exact-time collisions
  const occupiedMs = new Set<number>(existingSlots.map((s) => s.scheduledAt.getTime()))

  const todayStr = toLocalDateStr(now)
  const currentMins = nowLocalMins()

  // Derive chain position from filled/published slots so the stored chainPosition
  // never drifts out of sync with reality (e.g. after deleting empty slots).
  const filledCount = await prisma.postSlot.count({
    where: { brandId, status: { in: ['filled', 'published'] } },
  })
  let chainPos = filledCount % chain.length
  const slotsToCreate: Array<{ brandId: string; scheduledAt: Date; format: string; status: string }> = []

  const dayStart = new Date(todayLocal)
  dayStart.setUTCHours(0, 0, 0, 0)

  while (dayStart < cutoff) {
    const localDate = toLocalDateStr(dayStart)
    const isToday = localDate === todayStr
    const existingCount = countByDate[localDate] ?? 0

    // Determine effective posting window for this day
    let effStartMins: number
    let effEndMins: number = windowEndMins

    if (isToday) {
      if (currentMins > windowEndMins) {
        // Past the posting window — skip today entirely
        dayStart.setUTCDate(dayStart.getUTCDate() + 1)
        continue
      } else if (currentMins > windowStartMins) {
        // Inside the window — give 1 hour buffer from now
        effStartMins = currentMins + 60
        // If the buffer pushes past the window end, nothing fits today
        if (effStartMins >= windowEndMins) {
          dayStart.setUTCDate(dayStart.getUTCDate() + 1)
          continue
        }
      } else {
        // Before the window — use full window
        effStartMins = windowStartMins
      }
    } else {
      effStartMins = windowStartMins
    }

    if (existingCount < freq) {
      const needed = freq - existingCount
      // Space `needed` new slots evenly within the effective window
      const idealTimes = computeSlotTimes(dayStart, effStartMins, effEndMins, needed)

      for (const slotTime of idealTimes) {
        if (occupiedMs.has(slotTime.getTime())) continue

        slotsToCreate.push({
          brandId,
          scheduledAt: slotTime,
          format: chain[chainPos],
          status: 'empty',
        })
        occupiedMs.add(slotTime.getTime())
        chainPos = (chainPos + 1) % chain.length
      }
    }

    dayStart.setUTCDate(dayStart.getUTCDate() + 1)
  }

  if (slotsToCreate.length === 0) return 0

  await prisma.postSlot.createMany({ data: slotsToCreate, skipDuplicates: true })

  // Persist the advanced chain position
  if (chainPos !== schedule.chainPosition) {
    await prisma.postSchedule.update({
      where: { brandId },
      data: { chainPosition: chainPos },
    })
  }

  logger.info({ brandId, created: slotsToCreate.length, horizon }, '[SLOTS] Materialized slots')
  return slotsToCreate.length
}

/**
 * Converts a local HH:MM time on a given UTC calendar day to its UTC equivalent.
 * Handles DST transitions correctly.
 */
function localTimeToUTC(utcDay: Date, localH: number, localM: number, timezone: string): Date {
  const candidate = new Date(utcDay)
  candidate.setUTCHours(localH, localM, 0, 0)

  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(candidate)

    const displayH = parseInt(parts.find((p) => p.type === 'hour')?.value ?? String(localH))
    const displayM = parseInt(parts.find((p) => p.type === 'minute')?.value ?? String(localM))

    const diffMins = displayH * 60 + displayM - (localH * 60 + localM)
    return new Date(candidate.getTime() - diffMins * 60_000)
  } catch {
    return candidate
  }
}

/**
 * Returns midnight (UTC representation) for "today" in a given IANA timezone.
 */
function startOfTodayInTimezone(timezone: string): Date {
  try {
    const now = new Date()
    const [year, month, day] = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .format(now)
      .split('-')
      .map(Number)
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

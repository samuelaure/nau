import type { Prisma } from '@/generated/prisma'
import { prisma } from '@/modules/shared/prisma'
import { logger } from '@/modules/shared/logger'
import { runDraftPipeline } from '@/modules/composer/draft-pipeline'
import { getRecentDraftContext } from '@/modules/composer/recent-context.service'
import { triggerRenderForPost } from '@/modules/renderer/render-queue'
import { shuffle } from '@/modules/video/utils/assets'
import { signServiceToken } from '@nau/auth'

// ─── Template deck: shuffle-drain per format ──────────────────────────────────

type TemplateDeckEntry = {
  templateId: string
  autoApproveDraft: boolean
  template: {
    id: string
    format: string
    systemPrompt: string | null
    contentSchema: unknown
    slotSchema: unknown
    remotionId: string
  }
}

class TemplateDeck {
  private decks = new Map<string, TemplateDeckEntry[]>()
  private originals = new Map<string, TemplateDeckEntry[]>()

  async pick(brandId: string, format: string): Promise<TemplateDeckEntry | null> {
    const key = format === 'trial_reel' ? 'reel' : format

    if (!this.originals.has(key)) {
      const configs = await prisma.brandTemplateConfig.findMany({
        where: { brandId, enabled: true, template: { format: key } },
        select: {
          templateId: true,
          autoApproveDraft: true,
          template: {
            select: {
              id: true,
              format: true,
              systemPrompt: true,
              contentSchema: true,
              slotSchema: true,
              remotionId: true,
            },
          },
        },
      })
      this.originals.set(key, configs)
      this.decks.set(key, shuffle([...configs]))
    }

    const deck = this.decks.get(key)!
    if (deck.length === 0) {
      this.decks.set(key, shuffle([...this.originals.get(key)!]))
      deck.push(...this.decks.get(key)!)
    }

    return deck.shift() ?? null
  }
}

// ─── Zazŭ notification ───────────────────────────────────────────────────────

async function notifyViaZazu(brandId: string, markdown: string): Promise<void> {
  const zazuUrl = process.env.ZAZU_INTERNAL_URL || 'http://zazu:3000'
  const secret = process.env.AUTH_SECRET
  if (!secret) return
  try {
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { workspaceId: true },
    })
    if (!brand) return
    const apiUrl = process.env.NAU_API_URL || 'http://api:3000'
    const serviceToken = await signServiceToken({ iss: 'flownau', aud: '9nau-api', secret })
    const targetRes = await fetch(
      `${apiUrl}/workspaces/_service/${brand.workspaceId}/notification-target?app=flownau`,
      {
        headers: { Authorization: `Bearer ${serviceToken}` },
      },
    )
    if (!targetRes.ok) return
    const { nauUserIds } = (await targetRes.json()) as { nauUserIds: string[] }
    const notifyToken = await signServiceToken({ iss: 'flownau', aud: 'zazu', secret })
    await Promise.all(
      (nauUserIds ?? []).map((nauUserId) =>
        fetch(`${zazuUrl}/api/internal/notify`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${notifyToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ nauUserId, type: 'calendar_fill_blocked', brandId, markdown }),
        }).catch(() => {
          /* non-critical */
        }),
      ),
    )
  } catch {
    logger.warn({ brandId }, '[COVERAGE] Failed to send Zazŭ notification')
  }
}

// ─── Batch-rule window ────────────────────────────────────────────────────────
// No two consecutive scheduled posts from the same generationBatch; gap of 2 required.

const BATCH_GAP = 2

function batchExcludeFilter(recentBatchIds: (string | null)[]) {
  const excluded = recentBatchIds.filter((b): b is string => b !== null)
  if (excluded.length === 0) return {}
  return {
    OR: [{ generationBatchId: null }, { generationBatchId: { notIn: excluded } }],
  }
}

// ─── Time placement helpers ───────────────────────────────────────────────────

/**
 * Converts a local HH:MM (in fractional minutes) on a given UTC day to UTC.
 * DST-aware via Intl.DateTimeFormat offset detection.
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

function toLocalDateStr(d: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

/**
 * Computes N evenly-spaced UTC posting times for a given day within the posting window.
 * N=1 → [windowStart], N=2 → [windowStart, windowEnd], N≥3 → start + i*(range/(N-1)).
 * For today, times in the past or within 1 hour of now are filtered out.
 */
function computeIdealTimes(
  windowStart: string,
  windowEnd: string,
  N: number,
  timezone: string,
  day: Date,
  isToday: boolean,
): Date[] {
  const [sh, sm] = windowStart.split(':').map(Number)
  const [eh, em] = windowEnd.split(':').map(Number)
  const startMins = sh * 60 + sm
  const endMins = eh * 60 + em

  const times: Date[] = []
  if (N === 1) {
    times.push(localTimeToUTC(day, sh, sm, timezone))
  } else {
    const interval = (endMins - startMins) / (N - 1)
    for (let i = 0; i < N; i++) {
      const mins = startMins + i * interval
      times.push(localTimeToUTC(day, Math.floor(mins / 60), Math.round(mins % 60), timezone))
    }
  }

  if (!isToday) return times

  const bufferMs = 60 * 60 * 1000 // 1 hour
  const cutoff = Date.now() + bufferMs
  return times.filter((t) => t.getTime() >= cutoff)
}

// ─── Public result types ──────────────────────────────────────────────────────

export interface SmartFillResult {
  alreadyFull: boolean
  postsNeeded: number
  pastRescheduled: number
  ideasGenerated: number
  noDigest: boolean
  approvedIdeas: number
  postsFilled: number
  skippedByBatchRule: number
  needsApproval: number
}

export interface CoverageResult {
  postsFilled: number
}

// ─── Automatic fill (on publish) ─────────────────────────────────────────────

export async function runCoverageChecks(brandId: string): Promise<CoverageResult> {
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: {
      coverageHorizonDays: true,
      autoApproveIdeas: true,
      language: true,
      ideationCustomPrompt: true,
    },
  })
  if (!brand) throw new Error(`Brand ${brandId} not found`)

  const { postsFilled } = await fillCalendarForBrand(brandId, brand, 'automatic')
  logger.info({ brandId, postsFilled }, '[COVERAGE] Coverage check complete')
  return { postsFilled }
}

// ─── Manual fill (Fill Calendar button) ──────────────────────────────────────

export async function smartFillCalendar(brandId: string): Promise<SmartFillResult> {
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: {
      coverageHorizonDays: true,
      autoApproveIdeas: true,
      language: true,
      ideationCustomPrompt: true,
    },
  })
  if (!brand) throw new Error(`Brand ${brandId} not found`)

  return fillCalendarForBrand(brandId, brand, 'manual')
}

// ─── Core fill engine ─────────────────────────────────────────────────────────

async function fillCalendarForBrand(
  brandId: string,
  brand: {
    coverageHorizonDays: number
    autoApproveIdeas: boolean
    language: string
    ideationCustomPrompt?: string | null
  },
  source: 'manual' | 'automatic',
): Promise<SmartFillResult> {
  const schedule = await prisma.postSchedule.findUnique({ where: { brandId } })
  if (!schedule || !schedule.isActive || schedule.formatChain.length === 0) {
    return {
      alreadyFull: true,
      postsNeeded: 0,
      pastRescheduled: 0,
      ideasGenerated: 0,
      noDigest: false,
      approvedIdeas: 0,
      postsFilled: 0,
      skippedByBatchRule: 0,
      needsApproval: 0,
    }
  }

  const horizonDays = brand.coverageHorizonDays
  const todayLocal = startOfTodayInTimezone(schedule.timezone)
  const horizonEnd = new Date(todayLocal.getTime() + horizonDays * 24 * 60 * 60 * 1000)
  const todayStr = toLocalDateStr(new Date(), schedule.timezone)

  // Load all posts with scheduledAt in horizon to determine per-day counts
  const existingPosts = await prisma.post.findMany({
    where: { brandId, scheduledAt: { gte: todayLocal, lt: horizonEnd } },
    select: { scheduledAt: true },
    orderBy: { scheduledAt: 'asc' },
  })

  // Count per local date
  const countByDate: Record<string, number> = {}
  for (const p of existingPosts) {
    const d = toLocalDateStr(p.scheduledAt!, schedule.timezone)
    countByDate[d] = (countByDate[d] ?? 0) + 1
  }

  // Compute total posts needed across all days
  let postsNeeded = 0
  const dayStart = new Date(todayLocal)
  while (dayStart < horizonEnd) {
    const localDate = toLocalDateStr(dayStart, schedule.timezone)
    const existing = countByDate[localDate] ?? 0
    postsNeeded += Math.max(0, schedule.dailyFrequency - existing)
    dayStart.setUTCDate(dayStart.getUTCDate() + 1)
  }

  if (postsNeeded === 0) {
    return {
      alreadyFull: true,
      postsNeeded: 0,
      pastRescheduled: 0,
      ideasGenerated: 0,
      noDigest: false,
      approvedIdeas: 0,
      postsFilled: 0,
      skippedByBatchRule: 0,
      needsApproval: 0,
    }
  }

  // When auto-approve is on, any IDEA_PENDING posts are eligible — approve them now so Tier 2 can use them
  if (brand.autoApproveIdeas) {
    await prisma.post.updateMany({
      where: { brandId, status: 'IDEA_PENDING' },
      data: { status: 'IDEA_APPROVED' },
    })
  }

  // Fetch past posts that were scheduled but never published — reschedule these first
  const now = new Date()
  const pastUnpublished = await prisma.post.findMany({
    where: {
      brandId,
      scheduledAt: { lt: now },
      status: { notIn: ['PUBLISHED', 'FAILED', 'IDEA_PENDING', 'IDEA_APPROVED'] },
    },
    orderBy: { scheduledAt: 'asc' },
    select: { id: true, generationBatchId: true, format: true },
  })

  // Pre-generate ideas if we're short (past-unpublished posts count as available)
  let ideasGenerated = 0
  let noDigest = false
  const countAvailable = () =>
    prisma.post.count({
      where: { brandId, status: { in: ['IDEA_PENDING', 'IDEA_APPROVED'] } },
    })
  const countUnscheduledDrafts = () =>
    prisma.post.count({
      where: { brandId, status: { in: ['DRAFT_PENDING', 'DRAFT_APPROVED'] }, scheduledAt: null },
    })

  const [available, unscheduledDrafts] = await Promise.all([
    countAvailable(),
    countUnscheduledDrafts(),
  ])
  if (available + unscheduledDrafts + pastUnpublished.length < postsNeeded) {
    const result = await generateIdeasFromSourceConcepts(brandId, brand)
    if (!result.hasConcepts) {
      noDigest = true
    } else {
      let total = await countAvailable()
      ideasGenerated = total
      while (total < postsNeeded) {
        const again = await generateIdeasFromSourceConcepts(brandId, brand)
        if (!again.hasConcepts) break
        const next = await countAvailable()
        if (next <= total) break
        total = next
        ideasGenerated = total
      }
    }
  }

  const approvedIdeas = await prisma.post.count({ where: { brandId, status: 'IDEA_APPROVED' } })

  // ── Day-by-day fill loop ──────────────────────────────────────────────────
  const deck = new TemplateDeck()
  let chainPos = schedule.chainPosition
  let postsFilled = 0
  let pastRescheduled = 0
  let skippedByBatchRule = 0
  let notifyUserApproveIdeas = false

  // Initialise batch-rule window from last 2 scheduled posts before the horizon
  const recentBatchIds: (string | null)[] = []
  const priorPosts = await prisma.post.findMany({
    where: {
      brandId,
      scheduledAt: { lt: todayLocal },
      status: { notIn: ['IDEA_PENDING', 'IDEA_APPROVED'] },
    },
    orderBy: { scheduledAt: 'desc' },
    take: BATCH_GAP,
    select: { generationBatchId: true },
  })
  priorPosts.reverse().forEach((p) => recentBatchIds.push(p.generationBatchId ?? null))

  const advanceBatchWindow = (batchId: string | null) => {
    recentBatchIds.push(batchId)
    if (recentBatchIds.length > BATCH_GAP) recentBatchIds.shift()
  }

  // Reload existing post times per day (including ones just added during this run)
  // We track occupied times in memory to avoid N+1 re-queries
  const occupiedByDate: Record<string, number[]> = {}
  for (const p of existingPosts) {
    const d = toLocalDateStr(p.scheduledAt!, schedule.timezone)
    ;(occupiedByDate[d] ??= []).push(p.scheduledAt!.getTime())
  }

  const dayLoop = new Date(todayLocal)
  while (dayLoop < horizonEnd) {
    const localDate = toLocalDateStr(dayLoop, schedule.timezone)
    const isToday = localDate === todayStr
    const existingCount = countByDate[localDate] ?? 0
    const toFill = Math.max(0, schedule.dailyFrequency - existingCount)

    if (toFill > 0) {
      const idealTimes = computeIdealTimes(
        schedule.windowStart,
        schedule.windowEnd,
        schedule.dailyFrequency,
        schedule.timezone,
        dayLoop,
        isToday,
      )

      const TOLERANCE_MS = 4 * 60 * 1000
      const occupied = occupiedByDate[localDate] ?? []
      const freeTimes = idealTimes
        .filter((t) => !occupied.some((o) => Math.abs(o - t.getTime()) <= TOLERANCE_MS))
        .slice(0, toFill)

      for (const targetTime of freeTimes) {
        const format = schedule.formatChain[chainPos % schedule.formatChain.length]!
        chainPos++

        const batchFilter = batchExcludeFilter(recentBatchIds)
        const batchAnd = Object.keys(batchFilter).length > 0 ? [batchFilter] : []

        // Tier 0: reschedule past unpublished post (was scheduled, never published)
        const pastIdx = pastUnpublished.findIndex((p) => !p.format || p.format === format)
        if (pastIdx !== -1) {
          const past = pastUnpublished.splice(pastIdx, 1)[0]!
          await prisma.post.update({ where: { id: past.id }, data: { scheduledAt: targetTime } })
          advanceBatchWindow(past.generationBatchId)
          pastRescheduled++
          postsFilled++
          ;(occupiedByDate[localDate] ??= []).push(targetTime.getTime())
          countByDate[localDate] = (countByDate[localDate] ?? 0) + 1
          logger.info(
            { brandId, postId: past.id, targetTime },
            '[COVERAGE] Rescheduled past unpublished post',
          )
          continue
        }

        // Tier 1: unscheduled draft
        const existingDraft = await prisma.post.findFirst({
          where: {
            brandId,
            status: { in: ['DRAFT_PENDING', 'DRAFT_APPROVED'] },
            scheduledAt: null,
            AND: [{ OR: [{ format: null }, { format }] }, ...batchAnd],
          },
          orderBy: { createdAt: 'asc' },
        })

        if (existingDraft) {
          await prisma.post.update({
            where: { id: existingDraft.id },
            data: { format: existingDraft.format ?? format, scheduledAt: targetTime },
          })
          advanceBatchWindow(existingDraft.generationBatchId)
          postsFilled++
          ;(occupiedByDate[localDate] ??= []).push(targetTime.getTime())
          countByDate[localDate] = (countByDate[localDate] ?? 0) + 1
          logger.info(
            { brandId, postId: existingDraft.id, targetTime },
            '[COVERAGE] Scheduled existing draft',
          )
          continue
        }

        // Tier 2: IDEA_APPROVED → auto-compose
        const candidate = await prisma.post.findFirst({
          where: {
            brandId,
            status: 'IDEA_APPROVED',
            AND: [{ OR: [{ format: null }, { format }] }, ...batchAnd],
          },
          orderBy: { createdAt: 'asc' },
        })

        if (candidate) {
          const filled = await composeAndSchedule(brandId, candidate, format, targetTime, deck)
          if (filled) {
            advanceBatchWindow(candidate.generationBatchId)
            postsFilled++
            ;(occupiedByDate[localDate] ??= []).push(targetTime.getTime())
            countByDate[localDate] = (countByDate[localDate] ?? 0) + 1
          }
          continue
        }

        // No candidate — check if blocked by batch rule or truly empty
        const anyApproved = await prisma.post.count({
          where: { brandId, status: 'IDEA_APPROVED', OR: [{ format: null }, { format }] },
        })

        if (anyApproved > 0) {
          // Batch rule is blocking — try generating a new batch
          const generated = await tryGenerateNewBatch(brandId, brand)
          if (!generated.hasDigest) {
            noDigest = true
            skippedByBatchRule++
            if (source === 'automatic') {
              const name =
                (await prisma.brand.findUnique({ where: { id: brandId }, select: { name: true } }))
                  ?.name ?? brandId
              await notifyViaZazu(
                brandId,
                `⚠️ *Calendar fill blocked* — _${name}_\n\nAll approved ideas are from the same batch. Could not generate new ideas: no InspoBase digest available.\n\n${skippedByBatchRule} post(s) left unfilled.`,
              )
            }
            continue
          }
          if (!brand.autoApproveIdeas) {
            notifyUserApproveIdeas = true
            skippedByBatchRule++
            if (source === 'automatic') {
              const name =
                (await prisma.brand.findUnique({ where: { id: brandId }, select: { name: true } }))
                  ?.name ?? brandId
              await notifyViaZazu(
                brandId,
                `⚠️ *Calendar fill blocked* — _${name}_\n\nNew ideas were generated to satisfy the batch rule, but auto-approve is off.\n\nPlease approve ideas in the Ideas tab to continue filling the calendar.`,
              )
            }
            continue
          }
          // Retry with the fresh batch
          const retryCandidate = await prisma.post.findFirst({
            where: {
              brandId,
              status: 'IDEA_APPROVED',
              AND: [{ OR: [{ format: null }, { format }] }, ...batchAnd],
            },
            orderBy: { createdAt: 'asc' },
          })
          if (retryCandidate) {
            const filled = await composeAndSchedule(
              brandId,
              retryCandidate,
              format,
              targetTime,
              deck,
            )
            if (filled) {
              advanceBatchWindow(retryCandidate.generationBatchId)
              postsFilled++
              ;(occupiedByDate[localDate] ??= []).push(targetTime.getTime())
              countByDate[localDate] = (countByDate[localDate] ?? 0) + 1
            }
          } else {
            skippedByBatchRule++
          }
          continue
        }

        // Truly no ideas at all
        const pendingCount = await prisma.post.count({ where: { brandId, status: 'IDEA_PENDING' } })
        if (pendingCount > 0) {
          notifyUserApproveIdeas = true
          break
        }
        await triggerIdeaGeneration(brandId)
        break
      }
    }

    dayLoop.setUTCDate(dayLoop.getUTCDate() + 1)
  }

  // Persist advanced chain position
  const newChainPos = chainPos % schedule.formatChain.length
  if (newChainPos !== schedule.chainPosition) {
    await prisma.postSchedule.update({ where: { brandId }, data: { chainPosition: newChainPos } })
  }

  const needsApproval = notifyUserApproveIdeas
    ? Math.max(0, postsNeeded - postsFilled - skippedByBatchRule)
    : 0

  logger.info(
    { brandId, postsNeeded, postsFilled, pastRescheduled, ideasGenerated, skippedByBatchRule },
    '[COVERAGE] Fill complete',
  )

  return {
    alreadyFull: false,
    postsNeeded,
    pastRescheduled,
    ideasGenerated,
    noDigest,
    approvedIdeas,
    postsFilled,
    skippedByBatchRule,
    needsApproval,
  }
}

// ─── Compose a post and assign a scheduled time ───────────────────────────────

async function composeAndSchedule(
  brandId: string,
  candidate: { id: string; ideaText: string; generationBatchId: string | null; llmTrace: unknown },
  format: string,
  targetTime: Date,
  deck: TemplateDeck,
): Promise<boolean> {
  const templateConfig = await deck.pick(brandId, format)
  if (!templateConfig) {
    logger.warn(
      { brandId, postId: candidate.id, format },
      '[COVERAGE] No template for format — skipping',
    )
    return false
  }
  try {
    const recentContext = await getRecentDraftContext(brandId)
    const draftResult = await runDraftPipeline({
      ideaText: candidate.ideaText ?? '',
      brandId,
      templateId: templateConfig.template.id,
      recentContext,
    })
    const draftStatus = templateConfig.autoApproveDraft ? 'DRAFT_APPROVED' : 'DRAFT_PENDING'
    await prisma.post.update({
      where: { id: candidate.id },
      data: {
        format,
        creative: draftResult.creative as unknown as Prisma.InputJsonValue,
        caption: draftResult.caption,
        hashtags: draftResult.hashtags,
        templateId: draftResult.templateId,
        status: draftStatus,
        scheduledAt: targetTime,
        llmTrace: {
          ...((candidate.llmTrace as object) ?? {}),
          draftTrace: draftResult.trace,
        } as unknown as Prisma.InputJsonValue,
      },
    })
    if (draftStatus === 'DRAFT_APPROVED') {
      await triggerRenderForPost(candidate.id).catch((err) =>
        logger.error({ postId: candidate.id, err }, '[COVERAGE] triggerRenderForPost failed'),
      )
    }
    logger.info(
      { brandId, postId: candidate.id, format, draftStatus, targetTime },
      '[COVERAGE] Post composed and scheduled',
    )
    return true
  } catch (err) {
    logger.error({ brandId, postId: candidate.id, err }, '[COVERAGE] Auto-compose failed')
    return false
  }
}

// ─── Idea generation helpers ──────────────────────────────────────────────────

async function generateIdeasFromSourceConcepts(
  brandId: string,
  brand: { autoApproveIdeas: boolean; language: string; ideationCustomPrompt?: string | null },
): Promise<{ hasConcepts: boolean }> {
  try {
    const { fetchPendingSourceConcepts, generateSourceConcepts, markSourceConceptConsumed } =
      await import('@/modules/ideation/sources/inspo-source')
    const { generateContentIdeas } = await import('@/modules/ideation/ideation.service')

    let concepts = await fetchPendingSourceConcepts(brandId)
    if (concepts.length === 0) concepts = await generateSourceConcepts(brandId)
    if (concepts.length === 0) return { hasConcepts: false }

    const recentPosts = await prisma.post.findMany({
      where: {
        brandId,
        createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
        caption: { not: null },
      },
      select: { caption: true },
      take: 30,
    })
    const recentContent = recentPosts.map((p) => p.caption!.slice(0, 100))

    for (const concept of concepts) {
      const output = await generateContentIdeas({
        topic: concept.content,
        language: brand.language,
        recentContent,
        userInstructions: brand.ideationCustomPrompt ?? null,
        brandId,
      })
      const batchId = crypto.randomUUID()
      await Promise.all(
        output.ideas.map((idea) =>
          prisma.post.create({
            data: {
              brandId,
              ideaText: idea.concept,
              angle: idea.angle,
              status: brand.autoApproveIdeas ? 'IDEA_APPROVED' : 'IDEA_PENDING',
              source: 'automatic',
              priority: 3,
              sourceRef: concept.id,
              generationBatchId: batchId,
              llmTrace: { ideaTrace: output.trace } as unknown as Prisma.InputJsonValue,
            },
          }),
        ),
      )
      await markSourceConceptConsumed(concept.id)
      logger.info(
        { brandId, conceptId: concept.id, count: output.ideas.length },
        '[COVERAGE] Ideas generated from source concept',
      )
    }
    return { hasConcepts: true }
  } catch (err) {
    logger.error({ brandId, err }, '[COVERAGE] generateIdeasFromSourceConcepts failed')
    return { hasConcepts: false }
  }
}

async function tryGenerateNewBatch(
  brandId: string,
  brand: { autoApproveIdeas: boolean; language: string; ideationCustomPrompt?: string | null },
): Promise<{ hasDigest: boolean }> {
  const result = await generateIdeasFromSourceConcepts(brandId, brand)
  return { hasDigest: result.hasConcepts }
}

async function triggerIdeaGeneration(brandId: string): Promise<void> {
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { language: true, autoApproveIdeas: true, ideationCustomPrompt: true },
  })
  await generateIdeasFromSourceConcepts(brandId, {
    autoApproveIdeas: brand?.autoApproveIdeas ?? false,
    language: brand?.language ?? 'Spanish',
    ideationCustomPrompt: brand?.ideationCustomPrompt,
  })
}

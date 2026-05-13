import type { Prisma } from '@/generated/prisma'
import { prisma } from '@/modules/shared/prisma'
import { logger } from '@/modules/shared/logger'
import { materializeSlots } from './slot-materializer'
import { runDraftPipeline } from '@/modules/composer/draft-pipeline'
import { getRecentDraftContext } from '@/modules/composer/recent-context.service'
import { triggerRenderForPost } from '@/modules/renderer/render-queue'
import { shuffle } from '@/modules/video/utils/assets'
import { signServiceToken } from '@nau/auth'


// ─── Template deck: shuffle-drain per format ──────────────────────────────────
// Ensures even distribution: each template is used once before any repeats.

type TemplateDeckEntry = { templateId: string; autoApproveDraft: boolean; template: { id: string; format: string; systemPrompt: string | null; contentSchema: unknown; slotSchema: unknown; remotionId: string } }

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
          template: { select: { id: true, format: true, systemPrompt: true, contentSchema: true, slotSchema: true, remotionId: true } },
        },
      })
      this.originals.set(key, configs)
      this.decks.set(key, shuffle([...configs]))
    }

    const deck = this.decks.get(key)!
    if (deck.length === 0) {
      // All templates used once — refill and reshuffle
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
    const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { workspaceId: true } })
    if (!brand) return
    const apiUrl = process.env.NAU_API_URL || 'http://api:3000'
    const serviceToken = await signServiceToken({ iss: 'flownau', aud: '9nau-api', secret })
    const targetRes = await fetch(`${apiUrl}/workspaces/_service/${brand.workspaceId}/notification-target`, {
      headers: { Authorization: `Bearer ${serviceToken}` },
    })
    if (!targetRes.ok) return
    const { nauUserId } = (await targetRes.json()) as { nauUserId: string }
    const notifyToken = await signServiceToken({ iss: 'flownau', aud: 'zazu', secret })
    await fetch(`${zazuUrl}/api/internal/notify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${notifyToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ nauUserId, type: 'calendar_fill_blocked', brandId, markdown }),
    })
  } catch {
    logger.warn({ brandId }, '[COVERAGE] Failed to send Zazŭ notification')
  }
}

// ─── Batch-rule window ────────────────────────────────────────────────────────
// No two consecutive slots from the same generationBatch; gap of 2 slots required.

const BATCH_GAP = 2

function batchExcludeFilter(recentBatchIds: (string | null)[]) {
  const excluded = recentBatchIds.filter((b): b is string => b !== null)
  if (excluded.length === 0) return {}
  return {
    OR: [
      { generationBatchId: null },
      { generationBatchId: { notIn: excluded } },
    ],
  }
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export interface CoverageResult {
  check1: Check1Result
}

interface Check1Result {
  slotsInHorizon: number
  filledSlots: number
  emptySlots: number
  slotsFilledNow: number
  skippedByBatchRule: number
  ideasGenerated: boolean
  notifyUserApproveIdeas: boolean
  noDigest: boolean
}

/**
 * Runs after every successful PUBLISHED transition.
 * Ensures scheduling coverage (DRAFT_PENDING/APPROVED in calendar) for coverageHorizonDays.
 * Render is event-driven: every transition into DRAFT_APPROVED enqueues its own
 * render via triggerRenderForPost, so no separate render-coverage check is needed.
 */
export async function runCoverageChecks(brandId: string): Promise<CoverageResult> {
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { coverageHorizonDays: true, autoApproveIdeas: true, language: true },
  })
  if (!brand) throw new Error(`Brand ${brandId} not found`)

  const horizonDays = brand.coverageHorizonDays

  // Materialize slots first so they exist for the check
  await materializeSlots(brandId, horizonDays)

  const check1 = await runCheck1(brandId, horizonDays, brand, 'automatic')

  logger.info({ brandId, check1 }, '[COVERAGE] Coverage check complete')

  return { check1 }
}

// ─── Check 1: Scheduling coverage ────────────────────────────────────────────

async function runCheck1(
  brandId: string,
  horizonDays: number,
  brand: { autoApproveIdeas: boolean; language: string; ideationCustomPrompt?: string | null },
  source: 'manual' | 'automatic' = 'manual',
): Promise<Check1Result> {
  const targetEnd = new Date(Date.now() + (horizonDays) * 24 * 60 * 60 * 1000)

  // Count all slots in horizon
  const now = new Date()
  const [allSlots, filledSlots] = await Promise.all([
    prisma.postSlot.count({ where: { brandId, scheduledAt: { gt: now, lte: targetEnd } } }),
    prisma.postSlot.count({
      where: { brandId, scheduledAt: { gt: now, lte: targetEnd }, status: { in: ['filled', 'published'] } },
    }),
  ])

  const emptySlots = allSlots - filledSlots

  if (emptySlots === 0) {
    return { slotsInHorizon: allSlots, filledSlots, emptySlots: 0, slotsFilledNow: 0, skippedByBatchRule: 0, ideasGenerated: false, notifyUserApproveIdeas: false, noDigest: false }
  }

  // Get empty slots ordered by scheduledAt — only future ones
  const emptySlotRecords = await prisma.postSlot.findMany({
    where: { brandId, scheduledAt: { gt: now, lte: targetEnd }, status: 'empty' },
    orderBy: { scheduledAt: 'asc' },
  })

  let slotsFilledNow = 0
  let skippedByBatchRule = 0
  let ideasGenerated = false
  let notifyUserApproveIdeas = false
  let noDigest = false

  const deck = new TemplateDeck()

  // Initialise the batch-rule window from the 2 slots immediately before our fill window
  const recentBatchIds: (string | null)[] = []
  if (emptySlotRecords.length > 0) {
    const priorSlots = await prisma.postSlot.findMany({
      where: { brandId, scheduledAt: { lt: emptySlotRecords[0]!.scheduledAt }, status: { in: ['filled', 'published'] } },
      orderBy: { scheduledAt: 'desc' },
      take: BATCH_GAP,
      include: { post: { select: { generationBatchId: true } } },
    })
    priorSlots.reverse().forEach((s) => recentBatchIds.push(s.post?.generationBatchId ?? null))
  }

  const advanceBatchWindow = (batchId: string | null) => {
    recentBatchIds.push(batchId)
    if (recentBatchIds.length > BATCH_GAP) recentBatchIds.shift()
  }

  for (const slot of emptySlotRecords) {
    const batchFilter = batchExcludeFilter(recentBatchIds)

    // First: try to find an existing unscheduled draft respecting the batch rule
    const existingDraft = await prisma.post.findFirst({
      where: {
        brandId,
        status: { in: ['DRAFT_PENDING', 'DRAFT_APPROVED'] },
        scheduledAt: null,
        postSlot: null,
        AND: [
          { OR: [{ format: null }, { format: slot.format }] },
          ...(Object.keys(batchFilter).length > 0 ? [batchFilter] : []),
        ],
      },
      orderBy: { createdAt: 'asc' },
    })

    if (existingDraft) {
      await prisma.post.update({
        where: { id: existingDraft.id },
        data: { format: existingDraft.format ?? slot.format, scheduledAt: slot.scheduledAt },
      })
      await prisma.postSlot.update({
        where: { id: slot.id },
        data: { status: 'filled', postId: existingDraft.id },
      })
      advanceBatchWindow(existingDraft.generationBatchId)
      slotsFilledNow++
      logger.info({ brandId, slotId: slot.id, postId: existingDraft.id }, '[COVERAGE] Slot filled by existing unscheduled draft')
      continue
    }

    // Second: try to find an IDEA_APPROVED post respecting the batch rule
    const candidate = await prisma.post.findFirst({
      where: {
        brandId,
        status: 'IDEA_APPROVED',
        postSlot: null,
        AND: [
          { OR: [{ format: null }, { format: slot.format }] },
          ...(Object.keys(batchFilter).length > 0 ? [batchFilter] : []),
        ],
      },
      orderBy: { createdAt: 'asc' },
    })

    if (candidate) {
      const templateConfig = await deck.pick(brandId, slot.format)
      const templateId = templateConfig?.template.id ?? undefined

      try {
        let creative: unknown
        let caption = ''
        let hashtags: string[] = []
        let resolvedTemplateId: string | null = templateId ?? null

        if (!templateId) throw new Error('No template resolved for slot')
        const recentContext = await getRecentDraftContext(brandId)
        const draftResult = await runDraftPipeline({ ideaText: candidate.ideaText ?? '', brandId, templateId, recentContext })
        creative = draftResult.creative
        caption = draftResult.caption
        hashtags = draftResult.hashtags
        resolvedTemplateId = draftResult.templateId
        const draftTrace = draftResult.trace

        const autoApproveDraft = templateConfig?.autoApproveDraft ?? false
        const draftStatus = autoApproveDraft ? 'DRAFT_APPROVED' : 'DRAFT_PENDING'

        const existingTrace = await prisma.post.findUnique({ where: { id: candidate.id }, select: { llmTrace: true } })
        await prisma.post.update({
          where: { id: candidate.id },
          data: {
            format: slot.format,
            creative: creative as unknown as Prisma.InputJsonValue,
            caption,
            hashtags,
            templateId: resolvedTemplateId,
            status: draftStatus,
            scheduledAt: slot.scheduledAt,
            llmTrace: { ...(existingTrace?.llmTrace as object ?? {}), draftTrace } as unknown as Prisma.InputJsonValue,
          },
        })
        await prisma.postSlot.update({
          where: { id: slot.id },
          data: { status: 'filled', postId: candidate.id },
        })

        advanceBatchWindow(candidate.generationBatchId)
        slotsFilledNow++
        logger.info({ brandId, slotId: slot.id, postId: candidate.id, format: slot.format, draftStatus }, '[COVERAGE] Slot filled via auto-compose')

        if (draftStatus === 'DRAFT_APPROVED') {
          await triggerRenderForPost(candidate.id).catch((err) =>
            logger.error({ postId: candidate.id, err }, '[COVERAGE] triggerRenderForPost failed'),
          )
        }
      } catch (err) {
        logger.error({ brandId, slotId: slot.id, err }, '[COVERAGE] Auto-compose failed for slot')
      }
      continue
    }

    // No candidate passed batch filter — check if any approved ideas exist at all
    const anyApproved = await prisma.post.count({
      where: { brandId, status: 'IDEA_APPROVED', postSlot: null, OR: [{ format: null }, { format: slot.format }] },
    })

    if (anyApproved > 0) {
      // All approved ideas are from recently-used batches — need a new batch
      logger.info({ brandId, slotId: slot.id, recentBatchIds }, '[COVERAGE] Batch rule blocked all candidates — attempting idea generation')

      const generated = await tryGenerateNewBatch(brandId, brand)

      if (!generated.hasDigest) {
        noDigest = true
        skippedByBatchRule++
        if (source === 'automatic') {
          const brandName = (await prisma.brand.findUnique({ where: { id: brandId }, select: { name: true } }))?.name ?? brandId
          await notifyViaZazu(brandId, `⚠️ *Calendar fill blocked* — _${brandName}_\n\nAll approved ideas are from the same batch. Could not generate new ideas: no InspoBase digest available.\n\n${skippedByBatchRule} slot(s) left unfilled.`)
        }
        logger.warn({ brandId, slotId: slot.id }, '[COVERAGE] Batch rule: skipping slot — no digest for new batch')
        continue
      }

      if (!brand.autoApproveIdeas) {
        notifyUserApproveIdeas = true
        skippedByBatchRule++
        if (source === 'automatic') {
          const brandName = (await prisma.brand.findUnique({ where: { id: brandId }, select: { name: true } }))?.name ?? brandId
          await notifyViaZazu(brandId, `⚠️ *Calendar fill blocked* — _${brandName}_\n\nNew ideas were generated to satisfy the batch rule, but auto-approve is off.\n\nPlease approve ideas in the Ideas tab to continue filling the calendar.`)
        }
        logger.warn({ brandId, slotId: slot.id }, '[COVERAGE] Batch rule: skipping slot — new ideas pending approval')
        continue
      }

      // Ideas were generated and auto-approved — retry this slot
      const retryCandidate = await prisma.post.findFirst({
        where: {
          brandId,
          status: 'IDEA_APPROVED',
          postSlot: null,
          AND: [
            { OR: [{ format: null }, { format: slot.format }] },
            ...(Object.keys(batchFilter).length > 0 ? [batchFilter] : []),
          ],
        },
        orderBy: { createdAt: 'asc' },
      })

      if (!retryCandidate) {
        skippedByBatchRule++
        logger.warn({ brandId, slotId: slot.id }, '[COVERAGE] Batch rule: skipping slot — retry candidate not found after generation')
        continue
      }

      // Fall through: re-use the same compose logic via a tail-recursive-style push
      // Simplest: push this slot back at the front and let the next iteration handle it.
      // Instead, inline the compose for the retry candidate here.
      const templateConfig = await deck.pick(brandId, slot.format)
      const templateId = templateConfig?.template.id ?? undefined
      try {
        let creative: unknown
        let caption = ''
        let hashtags: string[] = []
        let resolvedTemplateId: string | null = templateId ?? null

        if (!templateId) throw new Error('No template resolved for slot')
        const recentContext = await getRecentDraftContext(brandId)
        const draftResult = await runDraftPipeline({ ideaText: retryCandidate.ideaText ?? '', brandId, templateId, recentContext })
        creative = draftResult.creative
        caption = draftResult.caption
        hashtags = draftResult.hashtags
        resolvedTemplateId = draftResult.templateId
        const draftTrace = draftResult.trace

        const autoApproveDraft = templateConfig?.autoApproveDraft ?? false
        const draftStatus = autoApproveDraft ? 'DRAFT_APPROVED' : 'DRAFT_PENDING'

        const existingRetryTrace = await prisma.post.findUnique({ where: { id: retryCandidate.id }, select: { llmTrace: true } })
        await prisma.post.update({ where: { id: retryCandidate.id }, data: { format: slot.format, creative: creative as unknown as Prisma.InputJsonValue, caption, hashtags, templateId: resolvedTemplateId, status: draftStatus, scheduledAt: slot.scheduledAt, llmTrace: { ...(existingRetryTrace?.llmTrace as object ?? {}), draftTrace } as unknown as Prisma.InputJsonValue } })
        await prisma.postSlot.update({ where: { id: slot.id }, data: { status: 'filled', postId: retryCandidate.id } })

        advanceBatchWindow(retryCandidate.generationBatchId)
        slotsFilledNow++
        logger.info({ brandId, slotId: slot.id, postId: retryCandidate.id }, '[COVERAGE] Slot filled via auto-compose after batch-rule generation')

        if (draftStatus === 'DRAFT_APPROVED') {
          await triggerRenderForPost(retryCandidate.id).catch((err) => logger.error({ postId: retryCandidate.id, err }, '[COVERAGE] triggerRenderForPost failed'))
        }
      } catch (err) {
        logger.error({ brandId, slotId: slot.id, err }, '[COVERAGE] Auto-compose failed for retry candidate')
      }
      continue
    }

    // No approved ideas at all (not a batch-rule issue)
    const pendingCount = await prisma.post.count({ where: { brandId, status: 'IDEA_PENDING' } })
    if (pendingCount > 0) {
      notifyUserApproveIdeas = true
      break
    }

    // Truly no ideas — trigger generation
    ideasGenerated = await triggerIdeaGeneration(brandId)
    break
  }

  return {
    slotsInHorizon: allSlots,
    filledSlots: filledSlots + slotsFilledNow,
    emptySlots,
    slotsFilledNow,
    skippedByBatchRule,
    ideasGenerated,
    notifyUserApproveIdeas,
    noDigest,
  }
}

// ─── Smart fill (manual trigger) ─────────────────────────────────────────────

export interface SmartFillResult {
  alreadyFull: boolean
  slotsNeeded: number           // empty slots at the start of this run
  ideasGenerated: number        // new ideas created during this run
  noDigest: boolean             // generation skipped — no inspo digest available
  approvedIdeas: number         // approved ideas available when slot-filling ran
  slotsFilled: number           // slots actually filled
  skippedByBatchRule: number    // slots skipped because batch-rule blocked all candidates
  needsApproval: number         // more approvals still needed to fill remaining slots
}

/**
 * Manual "Fill Calendar" trigger.
 * 1. Materialise slots for the full coverage horizon.
 * 2. Count the gap (empty slots).
 * 3. If total ideas < gap, generate ideas in batches until covered (or digest runs out).
 * 4. Fill slots using approved ideas (composing drafts as needed).
 * 5. Return rich status for the UI notification.
 */
export async function smartFillCalendar(brandId: string): Promise<SmartFillResult> {
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { coverageHorizonDays: true, autoApproveIdeas: true, language: true, ideationCustomPrompt: true },
  })
  if (!brand) throw new Error(`Brand ${brandId} not found`)

  const horizonDays = brand.coverageHorizonDays
  await materializeSlots(brandId, horizonDays)

  const targetEnd = new Date(Date.now() + (horizonDays) * 24 * 60 * 60 * 1000)
  const now = new Date()

  const [allSlots, filledSlots] = await Promise.all([
    prisma.postSlot.count({ where: { brandId, scheduledAt: { lte: targetEnd, gt: now } } }),
    prisma.postSlot.count({ where: { brandId, scheduledAt: { lte: targetEnd, gt: now }, status: { in: ['filled', 'published'] } } }),
  ])
  const slotsNeeded = allSlots - filledSlots

  if (slotsNeeded === 0) {
    return { alreadyFull: true, slotsNeeded: 0, ideasGenerated: 0, noDigest: false, approvedIdeas: 0, slotsFilled: 0, skippedByBatchRule: 0, needsApproval: 0 }
  }

  // Count all available ideas (pending + approved — not yet turned into drafts)
  const countAvailableIdeas = () =>
    prisma.post.count({
      where: { brandId, status: { in: ['IDEA_PENDING', 'IDEA_APPROVED'] } },
    })

  let totalIdeas = await countAvailableIdeas()
  let ideasGenerated = 0
  let noDigest = false

  // Generate ideas via source concepts until we have enough to cover the gap
  if (totalIdeas < slotsNeeded) {
    const result = await generateIdeasFromSourceConcepts(brandId, brand)
    if (!result.hasConcepts) {
      noDigest = true
      logger.warn({ brandId }, '[SMART_FILL] Idea generation skipped — no source concepts available')
    } else {
      totalIdeas = await countAvailableIdeas()
      ideasGenerated = totalIdeas
      // If still short after one generation round, run again (concepts were regenerated)
      while (totalIdeas < slotsNeeded) {
        const again = await generateIdeasFromSourceConcepts(brandId, brand)
        if (!again.hasConcepts) break
        totalIdeas = await countAvailableIdeas()
        // Safety: if count didn't grow, break to avoid infinite loop
        if (totalIdeas <= ideasGenerated) break
        ideasGenerated = totalIdeas
      }
      logger.info({ brandId, ideasGenerated }, '[SMART_FILL] Ideas generated')
    }
  }

  // Count approved ideas available for slot-filling
  const approvedIdeas = await prisma.post.count({
    where: { brandId, status: 'IDEA_APPROVED' },
  })

  // Run slot-filling (same logic as Check 1, minus the idea generation since we did it above)
  const check1 = await runCheck1(brandId, horizonDays, brand, 'manual')
  const slotsFilled = check1.slotsFilledNow

  const remainingEmpty = slotsNeeded - slotsFilled
  // How many more approved ideas are needed to fill the rest
  const approvedAfterFill = await prisma.post.count({
    where: { brandId, status: 'IDEA_APPROVED' },
  })
  const needsApproval = Math.max(0, remainingEmpty - approvedAfterFill)

  logger.info({ brandId, slotsNeeded, slotsFilled, ideasGenerated, approvedIdeas, needsApproval }, '[SMART_FILL] Complete')

  return {
    alreadyFull: false,
    slotsNeeded,
    ideasGenerated,
    noDigest: noDigest || check1.noDigest,
    approvedIdeas,
    slotsFilled,
    skippedByBatchRule: check1.skippedByBatchRule,
    needsApproval,
  }
}

// ─── Shared idea generation via source concepts ───────────────────────────────

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
      where: { brandId, createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) }, caption: { not: null } },
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
      })
      const batchId = crypto.randomUUID()
      await Promise.all(output.ideas.map((idea) =>
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
      ))
      await markSourceConceptConsumed(concept.id)
      logger.info({ brandId, conceptId: concept.id, count: output.ideas.length }, '[COVERAGE] Ideas generated from source concept')
    }

    return { hasConcepts: true }
  } catch (err) {
    logger.error({ brandId, err }, '[COVERAGE] generateIdeasFromSourceConcepts failed')
    return { hasConcepts: false }
  }
}

// ─── Single-batch idea generation (for batch-rule unblocking) ────────────────

async function tryGenerateNewBatch(
  brandId: string,
  brand: { autoApproveIdeas: boolean; language: string; ideationCustomPrompt?: string | null },
): Promise<{ hasDigest: boolean }> {
  const result = await generateIdeasFromSourceConcepts(brandId, brand)
  return { hasDigest: result.hasConcepts }
}

// ─── Idea generation trigger ──────────────────────────────────────────────────

async function triggerIdeaGeneration(brandId: string): Promise<boolean> {
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { language: true, autoApproveIdeas: true, ideationCustomPrompt: true },
  })
  const result = await generateIdeasFromSourceConcepts(brandId, {
    autoApproveIdeas: brand?.autoApproveIdeas ?? false,
    language: brand?.language ?? 'Spanish',
    ideationCustomPrompt: brand?.ideationCustomPrompt,
  })
  return result.hasConcepts
}

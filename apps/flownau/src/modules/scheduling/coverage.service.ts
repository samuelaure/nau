import type { Prisma } from '@prisma/client'
import { prisma } from '@/modules/shared/prisma'
import { logger } from '@/modules/shared/logger'
import { materializeSlots } from './slot-materializer'
import { composeDraft } from '@/modules/composer/draft-composer'
import { HeadTalkCreativeSchema } from '@/modules/composer/head-talk-composer'
import { CreativeDirectionSchema } from '@/types/scenes'

function schemaForFormat(format: string) {
  if (format === 'head_talk') return HeadTalkCreativeSchema
  return CreativeDirectionSchema
}

function schemaNameForFormat(format: string): string {
  if (format === 'head_talk') return 'HeadTalkCreative'
  return 'CreativeDirection'
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export interface CoverageResult {
  check1: Check1Result
  check2: Check2Result
}

interface Check1Result {
  slotsInHorizon: number
  filledSlots: number
  emptySlots: number
  slotsFilledNow: number
  ideasGenerated: boolean
  notifyUserApproveIdeas: boolean
}

interface Check2Result {
  renderedInHalfHorizon: number
  needed: number
  renderTriggered: number
  notifyUploadVideo: string[]    // postIds needing user video upload
  notifyApproveDrafts: boolean
}

/**
 * Runs after every successful PUBLISHED transition.
 * Check 1: Ensure scheduling coverage (DRAFT_PENDING/APPROVED in calendar) for coverageHorizonDays.
 * Check 2: Ensure render coverage (RENDERED_PENDING/APPROVED) for coverageHorizonDays / 2.
 */
export async function runCoverageChecks(brandId: string): Promise<CoverageResult> {
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { coverageHorizonDays: true, ideationCount: true, autoApproveIdeas: true, language: true },
  })
  if (!brand) throw new Error(`Brand ${brandId} not found`)

  const horizonDays = brand.coverageHorizonDays
  const halfHorizonDays = Math.ceil(horizonDays / 2)

  // Materialize slots first so they exist for the checks
  await materializeSlots(brandId, horizonDays + 1)

  const [check1, check2] = await Promise.all([
    runCheck1(brandId, horizonDays, brand),
    runCheck2(brandId, halfHorizonDays),
  ])

  logger.info({ brandId, check1, check2 }, '[COVERAGE] Coverage checks complete')

  return { check1, check2 }
}

// ─── Check 1: Scheduling coverage ────────────────────────────────────────────

async function runCheck1(
  brandId: string,
  horizonDays: number,
  brand: { ideationCount: number; autoApproveIdeas: boolean; language: string },
): Promise<Check1Result> {
  const targetEnd = new Date(Date.now() + (horizonDays + 1) * 24 * 60 * 60 * 1000)

  // Count all slots in horizon
  const [allSlots, filledSlots] = await Promise.all([
    prisma.postSlot.count({ where: { brandId, scheduledAt: { lte: targetEnd } } }),
    prisma.postSlot.count({
      where: { brandId, scheduledAt: { lte: targetEnd }, status: { in: ['filled', 'published'] } },
    }),
  ])

  const emptySlots = allSlots - filledSlots

  if (emptySlots === 0) {
    return { slotsInHorizon: allSlots, filledSlots, emptySlots: 0, slotsFilledNow: 0, ideasGenerated: false, notifyUserApproveIdeas: false }
  }

  // Get empty slots ordered by scheduledAt
  const emptySlotRecords = await prisma.postSlot.findMany({
    where: { brandId, scheduledAt: { lte: targetEnd }, status: 'empty' },
    orderBy: { scheduledAt: 'asc' },
  })

  let slotsFilledNow = 0
  let ideasGenerated = false
  let notifyUserApproveIdeas = false

  for (const slot of emptySlotRecords) {
    // First: try to find an existing unscheduled draft (already composed, just needs a slot)
    const existingDraft = await prisma.post.findFirst({
      where: {
        brandId,
        status: { in: ['DRAFT_PENDING', 'DRAFT_APPROVED'] },
        scheduledAt: null,
        postSlot: null,
        OR: [{ format: null }, { format: slot.format }],
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
      slotsFilledNow++
      logger.info(
        { brandId, slotId: slot.id, postId: existingDraft.id },
        '[COVERAGE] Slot filled by existing unscheduled draft',
      )
      continue
    }

    // Second: try to find an eligible IDEA_APPROVED post to compose into this slot
    const candidate = await prisma.post.findFirst({
      where: {
        brandId,
        status: 'IDEA_APPROVED',
        postSlot: null,
        OR: [{ format: null }, { format: slot.format }],
      },
      orderBy: { createdAt: 'asc' },
    })

    if (candidate) {
      // Pick a random enabled template for this format
      const templateConfig = await prisma.brandTemplateConfig.findFirst({
        where: { brandId, enabled: true, template: { format: slot.format } },
        select: { templateId: true, autoApproveDraft: true, customPrompt: true, template: { select: { id: true, format: true } } },
        // random-ish: order by updatedAt desc gives variety without a raw query
        orderBy: { updatedAt: 'desc' },
      })

      const templateId = templateConfig?.template.id ?? undefined

      // Auto-compose: idea → draft
      try {
        const result = await composeDraft({
          ideaText: candidate.ideaText ?? '',
          brandId,
          templateId,
          format: slot.format,
          outputSchema: schemaForFormat(slot.format),
          schemaName: schemaNameForFormat(slot.format),
        })

        const autoApproveDraft = templateConfig?.autoApproveDraft ?? false

        const draftStatus = autoApproveDraft ? 'DRAFT_APPROVED' : 'DRAFT_PENDING'

        // Update post: assign format, creative, scheduledAt → fills the slot
        await prisma.post.update({
          where: { id: candidate.id },
          data: {
            format: slot.format,
            creative: result.creative as unknown as Prisma.InputJsonValue,
            caption: result.caption,
            hashtags: result.hashtags,
            templateId: result.templateId ?? templateId ?? null,
            status: draftStatus,
            scheduledAt: slot.scheduledAt,
          },
        })

        // Mark slot filled
        await prisma.postSlot.update({
          where: { id: slot.id },
          data: { status: 'filled', postId: candidate.id },
        })

        slotsFilledNow++
        logger.info(
          { brandId, slotId: slot.id, postId: candidate.id, format: slot.format, draftStatus },
          '[COVERAGE] Slot filled via auto-compose',
        )
      } catch (err) {
        logger.error({ brandId, slotId: slot.id, err }, '[COVERAGE] Auto-compose failed for slot')
      }
    } else {
      // No IDEA_APPROVED candidate — check if there are IDEA_PENDING ones
      const pendingCount = await prisma.post.count({
        where: { brandId, status: 'IDEA_PENDING' },
      })

      if (pendingCount > 0) {
        notifyUserApproveIdeas = true
        break // no point filling more slots without ideas
      }

      // Truly no ideas — trigger generation
      ideasGenerated = await triggerIdeaGeneration(brandId, brand.ideationCount)
      break
    }
  }

  return {
    slotsInHorizon: allSlots,
    filledSlots: filledSlots + slotsFilledNow,
    emptySlots,
    slotsFilledNow,
    ideasGenerated,
    notifyUserApproveIdeas,
  }
}

// ─── Check 2: Render coverage ─────────────────────────────────────────────────

async function runCheck2(brandId: string, halfHorizonDays: number): Promise<Check2Result> {
  const halfEnd = new Date(Date.now() + halfHorizonDays * 24 * 60 * 60 * 1000)

  const renderedCount = await prisma.post.count({
    where: {
      brandId,
      status: { in: ['RENDERED_PENDING', 'RENDERED_APPROVED'] },
      scheduledAt: { lte: halfEnd },
    },
  })

  // Count how many slots exist in that window to know the target
  const slotsInWindow = await prisma.postSlot.count({
    where: { brandId, scheduledAt: { lte: halfEnd }, status: { in: ['filled', 'published'] } },
  })

  const needed = Math.max(0, slotsInWindow - renderedCount)

  if (needed === 0) {
    return { renderedInHalfHorizon: renderedCount, needed: 0, renderTriggered: 0, notifyUploadVideo: [], notifyApproveDrafts: false }
  }

  // Find DRAFT_APPROVED posts in this window to trigger rendering
  const draftsToRender = await prisma.post.findMany({
    where: {
      brandId,
      status: 'DRAFT_APPROVED',
      scheduledAt: { lte: halfEnd },
    },
    orderBy: { scheduledAt: 'asc' },
    take: needed,
    select: { id: true, format: true },
  })

  const notifyUploadVideo: string[] = []
  let renderTriggered = 0

  for (const draft of draftsToRender) {
    if (draft.format === 'head_talk') {
      // User must upload — can't auto-render
      notifyUploadVideo.push(draft.id)
    } else {
      // Advance to RENDERING to queue for the render worker
      await prisma.post.update({
        where: { id: draft.id },
        data: { status: 'RENDERING' },
      })
      renderTriggered++
    }
  }

  // If no DRAFT_APPROVED at all in that window, notify user to approve
  const notifyApproveDrafts = draftsToRender.length === 0 && needed > 0

  if (renderTriggered > 0) {
    logger.info({ brandId, renderTriggered }, '[COVERAGE] Triggered rendering for DRAFT_APPROVED posts')
  }
  if (notifyUploadVideo.length > 0) {
    logger.info({ brandId, count: notifyUploadVideo.length }, '[COVERAGE] Head talk posts need video upload')
  }

  return {
    renderedInHalfHorizon: renderedCount,
    needed,
    renderTriggered,
    notifyUploadVideo,
    notifyApproveDrafts,
  }
}

// ─── Smart fill (manual trigger) ─────────────────────────────────────────────

export interface SmartFillResult {
  alreadyFull: boolean
  slotsNeeded: number      // empty slots at the start of this run
  ideasGenerated: number   // new ideas created during this run
  noDigest: boolean        // generation skipped — no inspo digest available
  approvedIdeas: number    // approved ideas available when slot-filling ran
  slotsFilled: number      // slots actually filled
  needsApproval: number    // more approvals still needed to fill remaining slots
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
    select: { coverageHorizonDays: true, ideationCount: true, autoApproveIdeas: true, language: true, ideationPrompt: true },
  })
  if (!brand) throw new Error(`Brand ${brandId} not found`)

  const horizonDays = brand.coverageHorizonDays
  await materializeSlots(brandId, horizonDays + 1)

  const targetEnd = new Date(Date.now() + (horizonDays + 1) * 24 * 60 * 60 * 1000)
  const now = new Date()

  const [allSlots, filledSlots] = await Promise.all([
    prisma.postSlot.count({ where: { brandId, scheduledAt: { lte: targetEnd, gt: now } } }),
    prisma.postSlot.count({ where: { brandId, scheduledAt: { lte: targetEnd, gt: now }, status: { in: ['filled', 'published'] } } }),
  ])
  const slotsNeeded = allSlots - filledSlots

  if (slotsNeeded === 0) {
    return { alreadyFull: true, slotsNeeded: 0, ideasGenerated: 0, noDigest: false, approvedIdeas: 0, slotsFilled: 0, needsApproval: 0 }
  }

  // Count all available ideas (pending + approved — not yet turned into drafts)
  const countAvailableIdeas = () =>
    prisma.post.count({
      where: { brandId, status: { in: ['IDEA_PENDING', 'IDEA_APPROVED'] } },
    })

  let totalIdeas = await countAvailableIdeas()
  let ideasGenerated = 0
  let noDigest = false

  // Generate ideas in batches until we have enough to cover the gap
  if (totalIdeas < slotsNeeded) {
    const { fetchBrandDigest } = await import('@/modules/ideation/sources/inspo-source')
    const { generateContentIdeas } = await import('@/modules/ideation/ideation.service')
    const digest = await fetchBrandDigest(brandId)

    if (!digest?.content?.trim()) {
      noDigest = true
      logger.warn({ brandId }, '[SMART_FILL] Idea generation skipped — no digest available')
    } else {
      const recentPosts = await prisma.post.findMany({
        where: { brandId, createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) }, caption: { not: null } },
        select: { caption: true },
        take: 30,
      })
      const autoApprove = brand.autoApproveIdeas
      const batchSize = brand.ideationCount

      while (totalIdeas < slotsNeeded) {
        const count = Math.min(batchSize, slotsNeeded - totalIdeas)
        const output = await generateContentIdeas({
          topic: digest.content,
          language: brand.language,
          count,
          recentContent: recentPosts.map((p) => p.caption!.slice(0, 100)),
          userInstructions: brand.ideationPrompt ?? null,
        })
        const batchId = crypto.randomUUID()
        for (const idea of output.ideas) {
          await prisma.post.create({
            data: {
              brandId,
              ideaText: idea.concept,
              status: autoApprove ? 'IDEA_APPROVED' : 'IDEA_PENDING',
              source: 'automatic',
              priority: 3,
              generationBatchId: batchId,
            },
          })
        }
        ideasGenerated += output.ideas.length
        totalIdeas = await countAvailableIdeas()

        // Safety: if generation produced 0 ideas, break to avoid infinite loop
        if (output.ideas.length === 0) break
      }
      logger.info({ brandId, ideasGenerated }, '[SMART_FILL] Ideas generated')
    }
  }

  // Count approved ideas available for slot-filling
  const approvedIdeas = await prisma.post.count({
    where: { brandId, status: 'IDEA_APPROVED' },
  })

  // Run slot-filling (same logic as Check 1, minus the idea generation since we did it above)
  const check1 = await runCheck1(brandId, horizonDays, brand)
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
    noDigest,
    approvedIdeas,
    slotsFilled,
    needsApproval,
  }
}

// ─── Idea generation trigger ──────────────────────────────────────────────────

async function triggerIdeaGeneration(brandId: string, ideationCount: number): Promise<boolean> {
  try {
    const { fetchBrandDigest } = await import('@/modules/ideation/sources/inspo-source')
    const { generateContentIdeas } = await import('@/modules/ideation/ideation.service')

    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { language: true, autoApproveIdeas: true, ideationPrompt: true },
    })

    const digest = await fetchBrandDigest(brandId)
    if (!digest?.content?.trim()) {
      logger.warn({ brandId }, '[COVERAGE] Idea generation skipped — no digest/topic available')
      return false
    }

    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    const recentPosts = await prisma.post.findMany({
      where: { brandId, createdAt: { gte: fourteenDaysAgo }, caption: { not: null } },
      select: { caption: true },
      take: 30,
    })

    const output = await generateContentIdeas({
      topic: digest.content,
      language: brand?.language ?? 'Spanish',
      count: ideationCount,
      recentContent: recentPosts.map((p) => p.caption!.slice(0, 100)),
      userInstructions: brand?.ideationPrompt ?? null,
    })

    const autoApprove = brand?.autoApproveIdeas ?? false
    const batchId = crypto.randomUUID()
    for (const idea of output.ideas) {
      await prisma.post.create({
        data: {
          brandId,
          ideaText: idea.concept,
          status: autoApprove ? 'IDEA_APPROVED' : 'IDEA_PENDING',
          source: 'automatic',
          priority: 3,
          generationBatchId: batchId,
        },
      })
    }

    logger.info({ brandId, ideationCount: output.ideas.length }, '[COVERAGE] Triggered idea generation')
    return true
  } catch (err) {
    logger.error({ brandId, err }, '[COVERAGE] Failed to trigger idea generation')
    return false
  }
}

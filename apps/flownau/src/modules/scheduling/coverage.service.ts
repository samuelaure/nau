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
    // Try to find an eligible IDEA_APPROVED post (no format yet, or matching format)
    const candidate = await prisma.post.findFirst({
      where: {
        brandId,
        status: 'IDEA_APPROVED',
        postSlot: null, // not already assigned to a slot
        OR: [{ format: null }, { format: slot.format }],
      },
      orderBy: { createdAt: 'asc' },
    })

    if (candidate) {
      // Pick a random enabled template for this format
      const templateConfig = await prisma.brandTemplateConfig.findFirst({
        where: { brandId, enabled: true, template: { format: slot.format } },
        include: { template: { select: { id: true, format: true } } },
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

        // Resolve auto-approve
        const autoApproveDraft = templateConfig
          ? await prisma.brandTemplateConfig.findUnique({
              where: { brandId_templateId: { brandId, templateId: templateConfig.templateId } },
              select: { autoApproveDraft: true },
            }).then((c) => c?.autoApproveDraft ?? false)
          : false

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

// ─── Idea generation trigger ──────────────────────────────────────────────────

async function triggerIdeaGeneration(brandId: string, ideationCount: number): Promise<boolean> {
  try {
    // Fire-and-forget: call the internal ideation endpoint
    const baseUrl = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'
    const serviceSecret = process.env.AUTH_SECRET ?? ''

    await fetch(`${baseUrl}/api/cron/ideation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceSecret}`,
      },
      body: JSON.stringify({ brandId, count: ideationCount, source: 'coverage_check' }),
    })

    logger.info({ brandId, ideationCount }, '[COVERAGE] Triggered idea generation')
    return true
  } catch (err) {
    logger.error({ brandId, err }, '[COVERAGE] Failed to trigger idea generation')
    return false
  }
}

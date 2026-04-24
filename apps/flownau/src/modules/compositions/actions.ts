'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/modules/shared/prisma'
import { addRenderJob } from '@/modules/renderer/render-queue'
import { logError, logger } from '@/modules/shared/logger'

// ─── Composition Actions ────────────────────────────────────────────

export async function approveComposition(id: string): Promise<void> {
  try {
    await prisma.composition.update({
      where: { id },
      data: { status: 'approved' },
    })
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/compositions')
    revalidatePath(`/dashboard/compositions/${id}`)
    logger.info(`[CompositionAction] Approved composition ${id}`)
  } catch (err) {
    logError('[CompositionAction] Failed to approve composition', err)
  }
}

export async function deleteComposition(id: string): Promise<void> {
  try {
    await prisma.composition.delete({ where: { id } })
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/compositions')
    logger.info(`[CompositionAction] Deleted composition ${id}`)
  } catch (err) {
    logError('[CompositionAction] Failed to delete composition', err)
  }
}

export async function requeueRender(compositionId: string): Promise<void> {
  try {
    await addRenderJob(compositionId, 5)
    await prisma.composition.update({
      where: { id: compositionId },
      data: { status: 'approved' },
    })
    revalidatePath(`/dashboard/compositions/${compositionId}`)
    logger.info(`[CompositionAction] Re-queued render for composition ${compositionId}`)
  } catch (err) {
    logError('[CompositionAction] Failed to re-queue render', err)
  }
}

// ─── Idea Actions ───────────────────────────────────────────────────

export async function rejectIdea(id: string): Promise<void> {
  try {
    await prisma.contentIdea.update({
      where: { id },
      data: { status: 'REJECTED' },
    })
    revalidatePath('/dashboard/ideas')
    revalidatePath('/dashboard')
    logger.info(`[IdeaAction] Rejected idea ${id}`)
  } catch (err) {
    logError('[IdeaAction] Failed to reject idea', err)
  }
}

export async function approveIdea(id: string): Promise<void> {
  try {
    await prisma.contentIdea.update({
      where: { id },
      data: { status: 'USED' },
    })
    revalidatePath('/dashboard/ideas')
    revalidatePath('/dashboard')
    logger.info(`[IdeaAction] Approved idea ${id}`)
  } catch (err) {
    logError('[IdeaAction] Failed to approve idea', err)
  }
}

// ─── Plan Actions ───────────────────────────────────────────────────

export async function triggerDailyPlan(): Promise<void> {
  try {
    const res = await fetch(
      `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/api/cron/daily-plan`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      },
    )
    if (!res.ok) {
      const body = (await res.json()) as { error?: string }
      logError('[PlanAction] Plan generation failed', body.error)
      return
    }
    revalidatePath('/dashboard/plans')
    revalidatePath('/dashboard')
  } catch (err) {
    logError('[PlanAction] Failed to trigger daily plan', err)
  }
}

'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/modules/shared/prisma'
import { addRenderJob } from '@/modules/renderer/render-queue'
import { logError, logger } from '@/modules/shared/logger'

export async function approveComposition(id: string): Promise<void> {
  try {
    await prisma.post.update({ where: { id }, data: { status: 'DRAFT_APPROVED' } })
    revalidatePath('/dashboard')
    logger.info(`[PostAction] Approved post ${id}`)
  } catch (err) {
    logError('[PostAction] Failed to approve post', err)
  }
}

export async function deleteComposition(id: string): Promise<void> {
  try {
    await prisma.post.delete({ where: { id } })
    revalidatePath('/dashboard')
    logger.info(`[PostAction] Deleted post ${id}`)
  } catch (err) {
    logError('[PostAction] Failed to delete post', err)
  }
}

export async function requeueRender(postId: string): Promise<void> {
  try {
    await addRenderJob(postId, 5)
    await prisma.post.update({ where: { id: postId }, data: { status: 'RENDERING' } })
    revalidatePath(`/dashboard`)
    logger.info(`[PostAction] Re-queued render for post ${postId}`)
  } catch (err) {
    logError('[PostAction] Failed to re-queue render', err)
  }
}

export async function rejectIdea(id: string): Promise<void> {
  try {
    await prisma.post.delete({ where: { id } })
    revalidatePath('/dashboard')
    logger.info(`[PostAction] Rejected/deleted post ${id}`)
  } catch (err) {
    logError('[PostAction] Failed to reject post', err)
  }
}

export async function approveIdea(id: string): Promise<void> {
  try {
    await prisma.post.update({ where: { id }, data: { status: 'IDEA_APPROVED' } })
    revalidatePath('/dashboard')
    logger.info(`[PostAction] Approved idea ${id}`)
  } catch (err) {
    logError('[PostAction] Failed to approve idea', err)
  }
}

export async function triggerDailyPlan(): Promise<void> {
  try {
    const res = await fetch(
      `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/api/cron/daily-plan`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } },
    )
    if (!res.ok) {
      const body = (await res.json()) as { error?: string }
      logError('[PlanAction] Plan generation failed', body.error)
      return
    }
    revalidatePath('/dashboard')
  } catch (err) {
    logError('[PlanAction] Failed to trigger daily plan', err)
  }
}

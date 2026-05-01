import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { checkBrandAccess } from '@/modules/shared/actions'
import { renderQueue } from '@/modules/renderer/render-queue'
import { logError, logger } from '@/modules/shared/logger'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const post = await prisma.post.findUnique({ where: { id }, select: { id: true, brandId: true, status: true } })
    if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await checkBrandAccess(post.brandId)

    // Already out of the render pipeline — treat as success (idempotent)
    if (post.status !== 'RENDERING' && post.status !== 'DRAFT_APPROVED') {
      return NextResponse.json({ ok: true, alreadyReset: true })
    }

    // Remove any waiting/delayed jobs for this post from the queue
    const jobs = await renderQueue.getJobs(['waiting', 'delayed', 'active'])
    for (const job of jobs) {
      if (job.id?.startsWith(`render-${id}-`)) {
        await job.remove().catch(() => {})
      }
    }

    // Reset post to DRAFT_APPROVED so user can re-render
    await prisma.post.update({ where: { id }, data: { status: 'DRAFT_PENDING' } })
    await prisma.renderJob.updateMany({ where: { postId: id, status: { in: ['queued', 'rendering', 'uploading'] } }, data: { status: 'failed', error: 'Cancelled by user' } })

    logger.info({ postId: id }, '[CancelRender] Render cancelled by user')
    return NextResponse.json({ ok: true })
  } catch (error) {
    logError('POST /api/posts/[id]/cancel-render', error)
    return NextResponse.json({ error: 'Failed to cancel render' }, { status: 500 })
  }
}

import { prisma } from '@/modules/shared/prisma'
import { renderQueue, addRenderJob } from '@/modules/renderer/render-queue'

const postId = process.argv[2] ?? 'cmolfscgr002vm4v4lexiskl9'

async function main() {
  const jobId = `render-${postId}`

  // Check current post/template state
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { template: { select: { name: true, remotionId: true } } },
    })
  console.log('Post template:', post?.template?.name, 'remotionId:', post?.template?.remotionId)
  console.log('Creative type:', Object.keys(post?.creative as any ?? {}).join(', '))

  // Remove existing BullMQ job
  const existing = await renderQueue.getJob(jobId)
  if (existing) {
    const state = await existing.getState()
    console.log(`Removing job (state: ${state})`)
    await existing.remove()
  }

  // Reset DB
  await prisma.renderJob.upsert({
    where: { postId },
    update: { status: 'queued', progress: 0, error: null, startedAt: null, completedAt: null, attempts: 0 },
    create: { postId, status: 'queued', progress: 0 },
  })
  await prisma.post.update({ where: { id: postId }, data: { status: 'RENDERING' } })

  // Re-add
  await addRenderJob(postId)
  console.log(`✓ Re-enqueued ${postId}`)
}

main().catch(console.error).finally(async () => {
  await renderQueue.close()
  await prisma.$disconnect()
})

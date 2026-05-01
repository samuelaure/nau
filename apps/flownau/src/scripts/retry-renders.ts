import { prisma } from '@/modules/shared/prisma'
import { renderQueue, addRenderJob } from '@/modules/renderer/render-queue'

const POST_IDS = [
  'cmoie6u950004x4v4q6lbhkb5',
  'cmoie7b070005x4v4soxbsrit',
  'cmoie87dr000ax4v48ubadxb0',
  'cmolfscgr002vm4v4lexiskl9',
]

async function main() {
  for (const postId of POST_IDS) {
    const jobId = `render-${postId}`

    // Remove existing job (failed or otherwise)
    const existing = await renderQueue.getJob(jobId)
    if (existing) {
      console.log(`  Removing old job ${jobId} (state: ${await existing.getState()})`)
      await existing.remove()
    }

    // Reset RenderJob DB record
    await prisma.renderJob.upsert({
      where: { postId },
      update: { status: 'queued', progress: 0, error: null, startedAt: null, completedAt: null, attempts: 0 },
      create: { postId, status: 'queued', progress: 0 },
    })

    // Re-add job
    await addRenderJob(postId)
    console.log(`  ✓ Re-enqueued render for ${postId}`)
  }
  console.log('\n✅ All render jobs re-queued. Render worker should pick them up.')
}

main().catch(console.error).finally(async () => {
  await renderQueue.close()
  await prisma.$disconnect()
})

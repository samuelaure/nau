import { prisma } from '@/modules/shared/prisma'
import { renderQueue, addRenderJob } from '@/modules/renderer/render-queue'

// All reel posts for the target brand
const brandId = 'cmogyjn5a0006gcv46nis4o0l'

async function main() {
  const posts = await prisma.post.findMany({
    where: { brandId, format: 'reel' },
    select: { id: true, caption: true, creative: true },
  })

  console.log(`Found ${posts.length} reel posts`)

  for (const post of posts) {
    const creative = post.creative as { caption?: string; hashtags?: string[]; slots?: Record<string, string> } | null

    // Backfill top-level caption/hashtags if missing
    if (!post.caption && creative?.caption) {
      await prisma.post.update({
        where: { id: post.id },
        data: { caption: creative.caption, hashtags: creative.hashtags ?? [] },
      })
      console.log(`  Updated caption for ${post.id.slice(-8)}`)
    }

    // Remove old render job and re-queue
    const jobId = `render-${post.id}`
    const existing = await renderQueue.getJob(jobId)
    if (existing) {
      console.log(`  Removing job ${post.id.slice(-8)} (state: ${await existing.getState()})`)
      await existing.remove()
    }

    await prisma.renderJob.upsert({
      where: { postId: post.id },
      update: { status: 'queued', progress: 0, error: null, startedAt: null, completedAt: null, attempts: 0 },
      create: { postId: post.id, status: 'queued', progress: 0 },
    })
    await prisma.post.update({ where: { id: post.id }, data: { status: 'RENDERING' } })
    await addRenderJob(post.id)
    console.log(`  Queued ${post.id.slice(-8)}`)
  }

  console.log('\n✅ All reel posts re-queued with new timing')
}

main().catch(console.error).finally(async () => {
  await renderQueue.close()
  await prisma.$disconnect()
})

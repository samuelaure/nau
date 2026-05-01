import { prisma } from '@/modules/shared/prisma'

async function main() {
  const jobs = await prisma.renderJob.findMany({
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: { postId: true, status: true, progress: true, error: true, updatedAt: true },
  })
  console.log('Render jobs:')
  jobs.forEach(j => console.log(`  ${j.postId.slice(-8)} — ${j.status} (${j.progress}%) ${j.error ? `ERROR: ${j.error.slice(0, 60)}` : ''} updated: ${j.updatedAt.toISOString()}`))

  const posts = await prisma.post.findMany({
    where: { status: { in: ['RENDERING', 'RENDERED_PENDING', 'DRAFT_APPROVED', 'RENDERED_APPROVED'] } },
    select: { id: true, status: true, format: true, videoUrl: true, templateId: true },
    take: 10,
  })
  console.log('\nPosts in pipeline:')
  posts.forEach(p => console.log(`  ${p.id.slice(-8)} — ${p.status} (${p.format}) hasVideo: ${!!p.videoUrl}`))
}

main().catch(console.error).finally(() => prisma.$disconnect())

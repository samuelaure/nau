import { prisma } from '@/modules/shared/prisma'

const brandId = 'cmogyjn5a0006gcv46nis4o0l'

async function main() {
  const posts = await prisma.post.findMany({ where: { brandId }, select: { id: true, format: true, status: true } })
  console.log(`Deleting ${posts.length} posts...`)
  posts.forEach(p => console.log(`  ${p.id.slice(-8)} ${p.format} ${p.status}`))

  await prisma.renderJob.deleteMany({ where: { postId: { in: posts.map(p => p.id) } } })
  await prisma.post.deleteMany({ where: { brandId } })
  console.log('✅ All posts deleted.')
}

main().catch(console.error).finally(() => prisma.$disconnect())

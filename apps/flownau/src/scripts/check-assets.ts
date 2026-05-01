import { prisma } from '@/modules/shared/prisma'

const brandId = 'cmogyjn5a0006gcv46nis4o0l'

async function main() {
  const posts = await prisma.post.findMany({
    where: { brandId, format: 'reel' },
    select: { id: true, status: true, scheduledAt: true, videoUrl: true },
    orderBy: { updatedAt: 'desc' },
    take: 6,
  })
  console.log('Reel posts:')
  posts.forEach(p => console.log(`  ${p.id.slice(-8)} — ${p.status} scheduled:${p.scheduledAt?.toISOString() ?? 'none'} hasVideo:${!!p.videoUrl}`))

  const assets = await prisma.asset.findMany({ where: { brandId }, select: { id: true, type: true, tags: true }, take: 20 })
  console.log(`\nBrand assets: ${assets.length} total`)
  const byType: Record<string, number> = {}
  assets.forEach(a => { byType[a.type] = (byType[a.type] ?? 0) + 1 })
  console.log('By type:', JSON.stringify(byType))
  const videoAssets = assets.filter(a => a.type === 'video')
  console.log('Video assets:', videoAssets.length)
  videoAssets.forEach(a => console.log(`  ${a.id.slice(-8)} tags: [${a.tags.join(', ')}]`))
}

main().catch(console.error).finally(() => prisma.$disconnect())

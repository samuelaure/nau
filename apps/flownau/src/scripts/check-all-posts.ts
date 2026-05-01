import { prisma } from '@/modules/shared/prisma'

const postId = 'cmoml3k6c004e3wv4eu3fm9yd'
const brandId = 'cmogyjn5a0006gcv46nis4o0l'

async function main() {
  // Check the specific post
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { template: { select: { name: true, remotionId: true } } },
  })
  console.log('Post:', post?.id.slice(-8), post?.format, post?.status)
  console.log('Template:', post?.template?.name, '/', post?.template?.remotionId)
  const creative = post?.creative as any
  console.log('Creative keys:', Object.keys(creative ?? {}))
  console.log('Slots:', JSON.stringify(creative?.slots))
  console.log('brollMood:', creative?.brollMood)

  // Check brand assets
  const assets = await prisma.asset.findMany({
    where: { brandId, type: { in: ['video', 'VID'] } },
    select: { id: true, type: true, tags: true, url: true },
  })
  console.log(`\nBrand video assets: ${assets.length}`)
  assets.forEach(a => console.log(`  ${a.id.slice(-8)} type:${a.type} tags:[${a.tags.join(',')}] url:${a.url.slice(0, 60)}`))
}

main().catch(console.error).finally(() => prisma.$disconnect())

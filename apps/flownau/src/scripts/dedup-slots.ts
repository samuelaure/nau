import { prisma } from '@/modules/shared/prisma'

async function main() {
  // Find duplicate (brandId, scheduledAt) pairs
  const slots = await prisma.postSlot.findMany({
    select: { id: true, brandId: true, scheduledAt: true, status: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  const seen = new Map<string, string>()
  const toDelete: string[] = []

  for (const s of slots) {
    const key = `${s.brandId}|${s.scheduledAt.getTime()}`
    if (seen.has(key)) {
      toDelete.push(s.id)
    } else {
      seen.set(key, s.id)
    }
  }

  console.log(`Found ${toDelete.length} duplicate slots to delete`)
  if (toDelete.length > 0) {
    await prisma.postSlot.deleteMany({ where: { id: { in: toDelete } } })
    console.log('Deleted.')
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())

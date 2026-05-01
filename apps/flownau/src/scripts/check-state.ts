import { prisma } from '@/modules/shared/prisma'

async function main() {
  const brand = await prisma.brand.findFirst({ select: { id: true, name: true } })
  console.log('Brand:', JSON.stringify(brand))

  const ideas = await prisma.post.findMany({ where: { status: 'IDEA_APPROVED' }, select: { id: true, ideaText: true }, take: 6 })
  console.log('Approved ideas:', ideas.length)
  ideas.forEach((i, n) => console.log(`  [${n}] ${i.id}: ${i.ideaText.slice(0, 80)}`))

  const templates = await prisma.template.findMany({ where: { format: 'reel', scope: 'system' }, select: { id: true, name: true, remotionId: true } })
  console.log('Reel templates:', JSON.stringify(templates))

  const htTemplates = await prisma.template.findMany({ where: { format: 'head_talk', scope: 'system' }, select: { id: true, name: true } })
  console.log('Head talk templates:', htTemplates.map(t => t.name))
}

main().catch(console.error).finally(() => prisma.$disconnect())

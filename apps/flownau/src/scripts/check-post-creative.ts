import { prisma } from '@/modules/shared/prisma'

const POST_IDS = [
  'cmoie6u950004x4v4q6lbhkb5',
  'cmoie87dr000ax4v48ubadxb0',
  'cmolfscgr002vm4v4lexiskl9',
]

async function main() {
  for (const postId of POST_IDS) {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, format: true, status: true, templateId: true, creative: true },
    })
    const template = post?.templateId
      ? await prisma.template.findUnique({ where: { id: post.templateId }, select: { name: true, remotionId: true, slotSchema: true } })
      : null
    console.log(`\nPost ${postId.slice(-8)}:`)
    console.log(`  format: ${post?.format}`)
    console.log(`  status: ${post?.status}`)
    console.log(`  template: ${template?.name} (remotionId: ${template?.remotionId})`)
    const creative = post?.creative as any
    console.log(`  creative keys: ${creative ? Object.keys(creative).join(', ') : 'null'}`)
    console.log(`  creative.slots: ${JSON.stringify(creative?.slots)}`)
    console.log(`  creative.scenes: ${creative?.scenes ? `${creative.scenes.length} scenes` : 'none'}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())

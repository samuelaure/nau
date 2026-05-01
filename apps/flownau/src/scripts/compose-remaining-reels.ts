import { prisma } from '@/modules/shared/prisma'
import { renderQueue, addRenderJob } from '@/modules/renderer/render-queue'
import { composeSlots } from '@/modules/composer/slot-composer'

const brandId = 'cmogyjn5a0006gcv46nis4o0l'
const TEMPLATES = ['ReelT2', 'ReelT3', 'ReelT4']

async function main() {
  const brand = await prisma.brand.findUniqueOrThrow({ where: { id: brandId }, select: { id: true, ideationPrompt: true } })
  const ideaText = brand.ideationPrompt ?? 'Share valuable insights about our brand and services'

  for (const remotionId of TEMPLATES) {
    const template = await prisma.template.findFirstOrThrow({
      where: { remotionId },
      select: { id: true, name: true, remotionId: true, slotSchema: true },
    })
    console.log(`\nComposing ${template.name} (${remotionId})...`)

    const result = await composeSlots({ ideaText, brandId, templateId: template.id })
    console.log('  slots:', JSON.stringify(result.slots))
    console.log('  caption:', result.caption?.slice(0, 60))
    console.log('  brollMood:', result.brollMood)

    const post = await prisma.post.create({
      data: {
        brandId,
        templateId: template.id,
        format: 'reel',
        status: 'RENDERING',
        ideaText,
        caption: result.caption,
        hashtags: result.hashtags,
        creative: {
          slots: result.slots,
          caption: result.caption,
          hashtags: result.hashtags,
          brollMood: result.brollMood,
        },
      },
    })
    console.log(`  Created post ${post.id.slice(-8)}`)

    await prisma.renderJob.create({ data: { postId: post.id, status: 'queued' } })
    await addRenderJob(post.id)
    console.log(`  Queued render job`)
  }

  console.log('\n✅ All 3 reels composed and queued for rendering')
}

main().catch(console.error).finally(async () => {
  await renderQueue.close()
  await prisma.$disconnect()
})

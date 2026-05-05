import { prisma } from '@/modules/shared/prisma'
import { renderQueue, addRenderJob } from '@/modules/renderer/render-queue'
import { runDraftPipeline } from '@/modules/composer/draft-pipeline'

const brandId = 'cmogyjn5a0006gcv46nis4o0l'
const TEMPLATES = ['ReelT2', 'ReelT3', 'ReelT4']

async function main() {
  const brand = await prisma.brand.findUniqueOrThrow({ where: { id: brandId }, select: { id: true, ideationCustomPrompt: true } })
  const ideaText = brand.ideationCustomPrompt ?? 'Share valuable insights about our brand and services'

  for (const remotionId of TEMPLATES) {
    const template = await prisma.template.findFirstOrThrow({
      where: { remotionId },
      select: { id: true, name: true, remotionId: true, slotSchema: true },
    })
    console.log(`\nComposing ${template.name} (${remotionId})...`)

    const result = await runDraftPipeline({ ideaText, brandId, templateId: template.id })
    console.log('  creative:', JSON.stringify(result.creative).slice(0, 100))
    console.log('  caption:', result.caption?.slice(0, 60))

    const post = await prisma.post.create({
      data: {
        brandId,
        templateId: template.id,
        format: result.format,
        status: 'RENDERING',
        ideaText,
        caption: result.caption,
        hashtags: result.hashtags,
        creative: result.creative as any,
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

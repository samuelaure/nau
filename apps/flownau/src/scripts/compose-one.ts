/**
 * Compose one post with a specific template.
 * Usage: npx tsx src/scripts/compose-one.ts <ideaId> <templateName>
 */
import { prisma } from '@/modules/shared/prisma'
import { runDraftPipeline } from '@/modules/composer/draft-pipeline'
import { triggerRenderForPost, renderQueue } from '@/modules/renderer/render-queue'

const brandId = 'cmogyjn5a0006gcv46nis4o0l'

async function main() {
  const [, , ideaId, templateName] = process.argv

  if (!ideaId || !templateName) {
    console.error('Usage: npx tsx compose-one.ts <ideaId> <templateName>')
    process.exit(1)
  }

  const [idea, template] = await Promise.all([
    prisma.post.findUnique({ where: { id: ideaId }, select: { id: true, ideaText: true, status: true } }),
    prisma.template.findFirst({ where: { name: templateName }, select: { id: true, name: true, remotionId: true } }),
  ])

  if (!idea) { console.error('Idea not found'); process.exit(1) }
  if (!template) { console.error('Template not found'); process.exit(1) }

  console.log(`Composing ${template.name} (${template.remotionId}) for idea: ${idea.ideaText.slice(0, 80)}`)

  const result = await runDraftPipeline({ ideaText: idea.ideaText ?? '', brandId, templateId: template.id })
  console.log('Creative:', JSON.stringify(result.creative).slice(0, 200))
  console.log('Caption:', result.caption.slice(0, 100))

  await prisma.post.update({
    where: { id: idea.id },
    data: {
      format: result.format,
      templateId: template.id,
      creative: result.creative as any,
      caption: result.caption,
      hashtags: result.hashtags,
      status: 'DRAFT_APPROVED',
    },
  })
  console.log(`Post ${idea.id} updated → DRAFT_APPROVED`)

  const enqueueResult = await triggerRenderForPost(idea.id)
  console.log('Render enqueued:', JSON.stringify(enqueueResult))
}

main().catch(console.error).finally(async () => {
  await renderQueue.close()
  await prisma.$disconnect()
})

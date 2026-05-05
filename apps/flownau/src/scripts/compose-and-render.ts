/**
 * Dev script: compose one post per reel template + one head talk, then enqueue renders.
 * Usage: npx dotenv ... npx tsx src/scripts/compose-and-render.ts
 */
import { prisma } from '@/modules/shared/prisma'
import { runDraftPipeline } from '@/modules/composer/draft-pipeline'
import { triggerRenderForPost } from '@/modules/renderer/render-queue'

const brandId = 'cmogyjn5a0006gcv46nis4o0l'

const IDEAS = [
  'cmoie6u950004x4v4q6lbhkb5',
  'cmoie7b070005x4v4soxbsrit',
  'cmoie87dr000ax4v48ubadxb0',
  'cmolfscgr002vm4v4lexiskl9',
]

async function main() {
  const reelTemplates = await prisma.template.findMany({
    where: { format: 'reel', scope: 'system' },
    select: { id: true, name: true, remotionId: true },
    orderBy: { name: 'asc' },
  })

  const htTemplate = await prisma.template.findFirst({
    where: { format: 'head_talk', scope: 'system' },
    select: { id: true, name: true },
  })

  console.log(`\nComposing ${reelTemplates.length} reels + 1 head talk...\n`)

  const postIds: string[] = []

  for (let i = 0; i < reelTemplates.length; i++) {
    const template = reelTemplates[i]!
    const ideaId = IDEAS[i]
    if (!ideaId) continue
    const idea = await prisma.post.findUnique({ where: { id: ideaId }, select: { ideaText: true } })
    if (!idea) { console.log(`  Idea ${ideaId} not found`); continue }

    console.log(`  Composing ${template.name} (${template.remotionId})...`)
    try {
      const result = await runDraftPipeline({ ideaText: idea.ideaText ?? '', brandId, templateId: template.id })
      const post = await prisma.post.update({
        where: { id: ideaId },
        data: {
          format: result.format,
          templateId: template.id,
          creative: result.creative as any,
          caption: result.caption,
          hashtags: result.hashtags,
          status: 'DRAFT_APPROVED',
        },
      })
      postIds.push(post.id)
      console.log(`  Post ${post.id} updated`)
    } catch (err) {
      console.error(`  Failed: ${err instanceof Error ? err.message : err}`)
    }
  }

  if (htTemplate) {
    const htIdea = `La conexión entre padres e hijos se fortalece cuando los niños aprenden en libertad y confianza.`
    console.log(`\n  Composing head talk: ${htTemplate.name}...`)
    try {
      const result = await runDraftPipeline({ ideaText: htIdea, brandId, templateId: htTemplate.id })
      const htPost = await prisma.post.create({
        data: {
          brandId,
          ideaText: htIdea,
          format: result.format,
          templateId: htTemplate.id,
          creative: result.creative as any,
          caption: result.caption,
          hashtags: result.hashtags,
          status: 'DRAFT_APPROVED',
          source: 'manual',
        },
      })
      postIds.push(htPost.id)
      console.log(`  Head talk post ${htPost.id} created`)
    } catch (err) {
      console.error(`  Head talk failed: ${err instanceof Error ? err.message : err}`)
    }
  }

  console.log(`\nEnqueuing ${postIds.length} render jobs...`)
  for (const postId of postIds) {
    try {
      await triggerRenderForPost(postId)
      console.log(`  Render enqueued: ${postId}`)
    } catch (err) {
      console.error(`  Render enqueue failed for ${postId}: ${err instanceof Error ? err.message : err}`)
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())

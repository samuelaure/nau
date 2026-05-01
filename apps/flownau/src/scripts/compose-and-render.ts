/**
 * Test script: compose one post per reel template + one head talk, then enqueue renders.
 * Usage: npx dotenv ... npx tsx src/scripts/compose-and-render.ts
 */
import { prisma } from '@/modules/shared/prisma'
import { composeSlots } from '@/modules/composer/slot-composer'
import { composeDraft } from '@/modules/composer/draft-composer'
import { HeadTalkCreativeSchema } from '@/modules/composer/head-talk-composer'
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
    where: { format: 'head_talk', scope: 'system', name: 'Head Talk — Hook First' },
    select: { id: true, name: true },
  })

  console.log(`\n🎬 Composing ${reelTemplates.length} reels + 1 head talk...\n`)

  const postIds: string[] = []

  // Compose one reel per template
  for (let i = 0; i < reelTemplates.length; i++) {
    const template = reelTemplates[i]
    const ideaId = IDEAS[i]
    const idea = await prisma.post.findUnique({ where: { id: ideaId }, select: { ideaText: true } })
    if (!idea) { console.log(`  ⚠️  Idea ${ideaId} not found`); continue }

    console.log(`  Composing ${template.name} (${template.remotionId})...`)
    console.log(`    Idea: ${idea.ideaText.slice(0, 80)}`)

    try {
      const result = await composeSlots({ ideaText: idea.ideaText, brandId, templateId: template.id })
      console.log(`    ✓ Slots: ${JSON.stringify(result.slots)}`)
      console.log(`    Caption: ${result.caption.slice(0, 80)}...`)
      console.log(`    brollMood: ${result.brollMood}`)

      const post = await prisma.post.update({
        where: { id: ideaId },
        data: {
          format: 'reel',
          templateId: template.id,
          creative: { slots: result.slots, caption: result.caption, hashtags: result.hashtags, brollMood: result.brollMood },
          caption: result.caption,
          hashtags: result.hashtags,
          status: 'DRAFT_APPROVED',
        },
      })
      postIds.push(post.id)
      console.log(`    ✓ Post ${post.id} updated → DRAFT_APPROVED`)
    } catch (err) {
      console.error(`    ✗ Failed: ${err instanceof Error ? err.message : err}`)
    }
  }

  // Compose one head talk
  if (htTemplate) {
    const htIdea = `La conexión entre padres e hijos se fortalece cuando los niños aprenden en libertad y confianza.`
    console.log(`\n  Composing head talk: ${htTemplate.name}...`)
    try {
      const result = await composeDraft({
        ideaText: htIdea,
        brandId,
        templateId: htTemplate.id,
        format: 'head_talk',
        outputSchema: HeadTalkCreativeSchema,
        schemaName: 'HeadTalkCreative',
      })
      console.log(`    ✓ Hook: ${(result.creative as any).hook?.slice(0, 80)}`)
      console.log(`    ✓ Body: ${(result.creative as any).body?.slice(0, 80)}...`)

      const htPost = await prisma.post.create({
        data: {
          brandId,
          ideaText: htIdea,
          format: 'head_talk',
          templateId: htTemplate.id,
          creative: result.creative as any,
          caption: result.caption,
          hashtags: result.hashtags,
          status: 'DRAFT_APPROVED',
          source: 'manual',
        },
      })
      postIds.push(htPost.id)
      console.log(`    ✓ Head talk post ${htPost.id} created → DRAFT_APPROVED`)
    } catch (err) {
      console.error(`    ✗ Head talk failed: ${err instanceof Error ? err.message : err}`)
    }
  }

  // Trigger renders
  console.log(`\n🚀 Enqueuing ${postIds.length} render jobs...`)
  for (const postId of postIds) {
    try {
      await triggerRenderForPost(postId)
      console.log(`  ✓ Render enqueued: ${postId}`)
    } catch (err) {
      console.error(`  ✗ Render enqueue failed for ${postId}: ${err instanceof Error ? err.message : err}`)
    }
  }

  console.log('\n✅ Done. Start render worker: pnpm dev:worker')
}

main().catch(console.error).finally(() => prisma.$disconnect())

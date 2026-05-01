import { prisma } from '@/modules/shared/prisma'
import { composeDraft } from '@/modules/composer/draft-composer'
import { HeadTalkCreativeSchema } from '@/modules/composer/head-talk-composer'

const brandId = 'cmogyjn5a0006gcv46nis4o0l'

const IDEAS = [
  { idea: 'La conexión entre padres e hijos se fortalece cuando los niños aprenden en libertad y confianza.', template: 'Head Talk — Hook First' },
  { idea: 'El mayor dolor de los padres de homeschool es sentir que van contra la corriente, solos.', template: 'Head Talk — Pain of Niche' },
  { idea: 'Cuando dejé de obligar a mi hijo a estudiar, algo inesperado ocurrió: empezó a querer aprender.', template: 'Head Talk — Relatable Story' },
]

async function main() {
  for (const { idea, template: templateName } of IDEAS) {
    const template = await prisma.template.findFirst({
      where: { name: templateName },
      select: { id: true, name: true },
    })
    if (!template) { console.log(`Template not found: ${templateName}`); continue }

    console.log(`\nComposing ${template.name}...`)
    console.log(`Idea: ${idea.slice(0, 80)}`)

    const result = await composeDraft({
      ideaText: idea,
      brandId,
      templateId: template.id,
      format: 'head_talk',
      outputSchema: HeadTalkCreativeSchema,
      schemaName: 'HeadTalkCreative',
    })

    const creative = result.creative as any
    console.log(`  Hook: ${creative.hook ?? creative.sections?.hook ?? 'N/A'}`)
    console.log(`  Body: ${(creative.body ?? creative.sections?.body ?? '').toString().slice(0, 100)}...`)
    console.log(`  CTA:  ${creative.cta ?? creative.sections?.cta ?? 'N/A'}`)
    console.log(`  Caption: ${result.caption.slice(0, 80)}...`)

    await prisma.post.create({
      data: {
        brandId,
        ideaText: idea,
        format: 'head_talk',
        templateId: template.id,
        creative: creative,
        caption: result.caption,
        hashtags: result.hashtags,
        status: 'DRAFT_APPROVED',
        source: 'manual',
      },
    })
    console.log(`  ✓ Head talk post created`)
  }
}

main().then(() => console.log('\n✅ All head talks composed')).catch(console.error).finally(() => prisma.$disconnect())

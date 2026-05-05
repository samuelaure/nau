import { prisma } from '@/modules/shared/prisma'
import { runDraftPipeline } from '@/modules/composer/draft-pipeline'

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
    const result = await runDraftPipeline({ ideaText: idea, brandId, templateId: template.id })
    const creative = result.creative as any
    console.log(`  Hook: ${creative.hook ?? 'N/A'}`)
    console.log(`  Caption: ${result.caption.slice(0, 80)}...`)

    await prisma.post.create({
      data: {
        brandId,
        ideaText: idea,
        format: result.format,
        templateId: template.id,
        creative,
        caption: result.caption,
        hashtags: result.hashtags,
        status: 'DRAFT_APPROVED',
        source: 'manual',
      },
    })
    console.log(`  Post created`)
  }
}

main().then(() => console.log('\nDone')).catch(console.error).finally(() => prisma.$disconnect())

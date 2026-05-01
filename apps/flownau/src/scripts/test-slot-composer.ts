import { prisma } from '@/modules/shared/prisma'
import { composeSlots } from '@/modules/composer/slot-composer'

const brandId = 'cmogyjn5a0006gcv46nis4o0l'

async function main() {
  const template = await prisma.template.findFirst({
    where: { name: 'Reel — Arc' },
    select: { id: true, name: true, remotionId: true },
  })
  console.log('Template:', template)

  const result = await composeSlots({
    ideaText: 'Homeschool en el bosque: aprender con la naturaleza como maestra',
    brandId,
    templateId: template!.id,
  })
  console.log('Result:', JSON.stringify(result, null, 2))
}

main().then(() => console.log('DONE')).catch(e => console.error('ERROR:', e.message)).finally(() => prisma.$disconnect())

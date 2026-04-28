import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { seedSystemTemplates, seedTemplatesForBrand } from './seeds/templates'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  // Seed system-scoped platform templates (available to all brands)
  console.log('\n📐 Seeding system templates…')
  await seedSystemTemplates(prisma)

  // Activate system templates for all existing brands
  const brands = await prisma.brand.findMany()
  for (const brand of brands) {
    console.log(`\n🔗 Activating system templates for brand "${brand.name}" (${brand.id})…`)
    await seedTemplatesForBrand(prisma, brand.id)
  }

  if (brands.length === 0) {
    console.log(
      'ℹ️ No brands found — system templates seeded. Run seed again after creating the first brand to activate them.',
    )
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })

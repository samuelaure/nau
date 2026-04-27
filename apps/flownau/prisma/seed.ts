import { PrismaClient } from '@prisma/client'
import { seedTemplatesForBrand } from './seeds/templates'

const prisma = new PrismaClient()

async function main() {
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD

  if (!adminEmail || !adminPassword) {
    console.log(
      'ℹ️ Skipping admin creation: INITIAL_ADMIN_EMAIL or INITIAL_ADMIN_PASSWORD not set. Use 9naŭ API to create users.',
    )
  } else {
    console.log(
      'ℹ️ Admin users are now managed by 9naŭ API. Register via POST /api/auth/register on the 9naŭ service.',
    )
  }

  // Seed platform-default templates for the first brand found.
  // Templates are workspace-scoped so all brands in the workspace can use them.
  // If no brands exist yet, seeding is deferred — run again after first brand is created,
  // or call seedTemplatesForBrand(prisma, brandId) directly from a setup script.
  const firstBrand = await prisma.brand.findFirst()
  if (firstBrand) {
    console.log(`\n📐 Seeding platform templates for brand "${firstBrand.name}" (${firstBrand.id})…`)
    await seedTemplatesForBrand(prisma, firstBrand.id)
  } else {
    console.log(
      'ℹ️ No brands found — template seeding deferred. Run seed again after creating the first brand.',
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
  })

import { PrismaClient } from '@prisma/client'

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

  // Phase 18: Templates are now account-scoped (require accountId).
  // Sample template and backup restoration are skipped in seed — use the dashboard to create templates.
  console.log(
    'ℹ️ Template seeding skipped — templates are account-scoped (Phase 18). Create via the account Templates tab.',
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

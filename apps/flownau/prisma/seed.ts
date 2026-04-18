import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

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

  // Add a sample template
  if (process.env.AIRTABLE_ASFA_T1_TABLE_ID) {
    const template = await prisma.template.upsert({
      where: { id: 'sample-template' },
      update: {},
      create: {
        id: 'sample-template',
        name: 'Instagram Post v1',
        remotionId: 'InstagramPost',
      },
    })

    console.log('✅ Sample template created:', template.name)
  } else {
    console.log('ℹ️ Skipping sample template: AIRTABLE_ASFA_T1_TABLE_ID not set')
  }

  // Restore VideoTemplates from backup
  try {
    const backupPath = path.join(process.cwd(), 'backups', 'templates-backup-latest.json')
    if (fs.existsSync(backupPath)) {
      const backupData = fs.readFileSync(backupPath, 'utf8')
      const templates = JSON.parse(backupData)

      let restoredCount = 0
      for (const t of templates) {
        await prisma.template.upsert({
          where: { id: t.id },
          update: t,
          create: t,
        })
        restoredCount++
      }
      console.log(`✅ Restored ${restoredCount} VideoTemplates from backup.`)
    } else {
      console.log('ℹ️ No VideoTemplate backup found at', backupPath)
    }
  } catch (err) {
    console.error('❌ Failed to restore VideoTemplates:', err)
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

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import bcrypt from 'bcryptjs'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD

  if (!adminEmail || !adminPassword) {
    console.error('❌ Skipping admin creation: INITIAL_ADMIN_EMAIL or INITIAL_ADMIN_PASSWORD not set in .env')
  } else {
    const hashedPassword = await bcrypt.hash(adminPassword, 10)

    const admin = await prisma.user.upsert({
      where: { email: adminEmail },
      update: {},
      create: {
        email: adminEmail,
        name: process.env.INITIAL_ADMIN_NAME || 'Admin',
        password: hashedPassword,
      },
    })
    console.log('✅ Admin user ensured:', admin.email)
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
        airtableTableId: process.env.AIRTABLE_ASFA_T1_TABLE_ID,
      },
    })

    console.log('✅ Sample template created:', template.name)
  } else {
    console.log('ℹ️ Skipping sample template: AIRTABLE_ASFA_T1_TABLE_ID not set')
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

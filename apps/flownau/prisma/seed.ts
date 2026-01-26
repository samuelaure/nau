import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import bcrypt from 'bcryptjs'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com'
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'

  const hashedPassword = await bcrypt.hash(adminPassword, 10)

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: 'Samuel Aure',
      password: hashedPassword,
    },
  })

  console.log('Admin user created:', admin.email)

  // Add a sample template
  const template = await prisma.template.upsert({
    where: { id: 'sample-template' },
    update: {},
    create: {
      id: 'sample-template',
      name: 'Instagram Post v1',
      remotionId: 'InstagramPost',
      airtableTableId: process.env.AIRTABLE_ASFA_T1_TABLE_ID || 'tblC7lVTkY0ftzNoS',
    },
  })

  console.log('Sample template created:', template.name)
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

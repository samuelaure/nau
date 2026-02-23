import { prisma } from './prisma'
import bcrypt from 'bcryptjs'

/**
 * Ensures the system has at least one admin user if the database is fresh.
 * Uses environment variables for initial credentials.
 */
export async function bootstrapSystem() {
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD
  const adminName = process.env.INITIAL_ADMIN_NAME || 'Admin'

  if (!adminEmail || !adminPassword) {
    return
  }

  const hashedPassword = await bcrypt.hash(adminPassword, 10)

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {}, // Don't change existing admin
    create: {
      email: adminEmail,
      password: hashedPassword,
      name: adminName,
    },
  })
}

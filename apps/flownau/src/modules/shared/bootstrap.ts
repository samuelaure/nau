import { prisma } from './prisma'
import bcrypt from 'bcryptjs'
import { validateEnv } from './env-validation'

/**
 * Ensures the system has at least one admin user if the database is fresh.
 * Uses environment variables for initial credentials.
 * Build-safe: silently no-ops if the database is unreachable (e.g. during Docker image build).
 */
export async function bootstrapSystem() {
  if (process.env.NODE_ENV === 'test') return

  // 1. Env Validation (Runtime)
  try {
    validateEnv()
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err))
    if (process.env.NODE_ENV === 'production') {
      throw err
    }
  }

  const adminEmail = process.env.INITIAL_ADMIN_EMAIL
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD
  const adminName = process.env.INITIAL_ADMIN_NAME || 'Admin'

  if (!adminEmail || !adminPassword) {
    return
  }

  try {
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
  } catch (err) {
    // Skip during build-time or when DB is not yet available.
    // Log at warn level so dev environments show this if it happens unexpectedly.
    // Use console.warn (not pino logger) — pino may not be initialized at build time.
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[Bootstrap] DB unavailable during bootstrap (expected at build time):',
        err instanceof Error ? err.message : String(err),
      )
    }
  }
}

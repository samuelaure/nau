import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

// Lazy initialization: pool is only created when DATABASE_URL is actually present.
// This prevents build-time crashes when Next.js statically evaluates the module tree.
function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    // Return a bare PrismaClient — it will throw at query time, not at import time.
    return new PrismaClient()
  }
  const pool = new pg.Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

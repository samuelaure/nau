import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

// Lazy initialization: pool is only created when DATABASE_URL is actually present.
// This prevents build-time crashes when Next.js statically evaluates the module tree.
// Prisma 7+ requires an adapter — returning new PrismaClient() with no args is invalid,
// so we use a Proxy that throws only when a query method is actually invoked.
function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    return new Proxy({} as PrismaClient, {
      get(_target, prop) {
        throw new Error(
          `PrismaClient accessed at build time (property: ${String(prop)}). DATABASE_URL is not set.`,
        )
      },
    })
  }
  const pool = new pg.Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

const globalForNauPrisma = global as unknown as { nauPrisma: PrismaClient }

export const prisma = globalForNauPrisma.nauPrisma || createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForNauPrisma.nauPrisma = prisma

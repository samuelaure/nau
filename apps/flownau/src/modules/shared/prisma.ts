import { PrismaClient } from '@/generated/prisma'

// Lazy initialization: pool is only created when DATABASE_URL is actually present.
// This prevents build-time crashes when Next.js statically evaluates the module tree.
// pg and @prisma/adapter-pg are required() inside the function (not top-level imports)
// so Turbopack does not trace them into the SSR bundle with fingerprinted module IDs.
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
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pg = require('pg') as typeof import('pg')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaPg } = require('@prisma/adapter-pg') as typeof import('@prisma/adapter-pg')
  const pool = new pg.Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({
    adapter,
    log: [],
  })
}

const globalForNauPrisma = global as unknown as { nauPrisma: PrismaClient }

export const prisma = globalForNauPrisma.nauPrisma || createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForNauPrisma.nauPrisma = prisma

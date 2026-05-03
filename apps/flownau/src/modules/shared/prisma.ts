import { createRequire } from 'node:module'
import { PrismaClient } from '@/generated/prisma'

// Lazy initialization: pool is only created when DATABASE_URL is actually present.
// This prevents build-time crashes when Next.js statically evaluates the module tree.
//
// pg and @prisma/adapter-pg are loaded via createRequire() with a variable name,
// NOT a string literal. This prevents Turbopack from statically tracing them into
// the SSR bundle with fingerprinted module IDs (pkg-HASH format), which would fail
// because the hashed names don't exist in node_modules at runtime.
// The Dockerfile installs these packages into .next/node_modules/ so Node.js can
// resolve them at runtime via normal directory walk-up from the SSR chunk location.
// createRequire is also necessary for the renderer worker which runs as ESM (tsx).
const _require = createRequire(import.meta.url)

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
  // Variable names prevent Turbopack static analysis from fingerprinting these as externals
  const pgMod = 'pg'
  const adapterMod = '@prisma/adapter-pg'
  const pg = _require(pgMod) as typeof import('pg')
  const { PrismaPg } = _require(adapterMod) as typeof import('@prisma/adapter-pg')
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

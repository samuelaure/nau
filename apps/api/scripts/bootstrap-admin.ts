/**
 * Creates the platform workspace and an invite token for the first admin user.
 * Run once on a fresh database before first login.
 *
 * Usage (dev):
 *   DATABASE_URL="..." ADMIN_EMAIL="you@example.com" npx tsx scripts/bootstrap-admin.ts
 *
 * Or via npm script:
 *   pnpm --filter api bootstrap
 */

import { Client } from 'pg'
import * as crypto from 'crypto'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) { console.error('DATABASE_URL is required'); process.exit(1) }

const ACCOUNTS_URL = process.env.ACCOUNTS_URL ?? 'https://accounts.9nau.com'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? ''
const TTL_DAYS = 30

async function main() {
  const client = new Client({ connectionString: DATABASE_URL })
  await client.connect()

  try {
    // Bail if any user already exists
    const { rows: users } = await client.query('SELECT id FROM "User" LIMIT 1')
    if (users.length > 0) {
      console.error('❌  Database already has users. Bootstrap is only for fresh installations.')
      process.exit(1)
    }

    // Create the platform workspace
    const workspaceId = crypto.randomBytes(12).toString('hex').slice(0, 25)
    const now = new Date().toISOString()
    await client.query(
      `INSERT INTO "Workspace" (id, name, slug, timezone, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $5)`,
      [workspaceId, 'naŭ Platform', 'nau-platform', 'UTC', now],
    )
    console.log(`✓  Created workspace "naŭ Platform" (${workspaceId})`)

    // Create the invite token
    const inviteId = crypto.randomBytes(12).toString('hex').slice(0, 25)
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()
    await client.query(
      `INSERT INTO "InviteToken" (id, token, email, "workspaceId", role, "createdById", "expiresAt", "createdAt")
       VALUES ($1, $2, $3, $4, 'OWNER', 'bootstrap', $5, $6)`,
      [inviteId, token, ADMIN_EMAIL, workspaceId, expiresAt, now],
    )

    const url = `${ACCOUNTS_URL}/register?invite=${token}`
    console.log(`✓  Admin invite created — expires ${expiresAt.slice(0, 10)}`)
    console.log(`\n🔗  Registration link:\n\n    ${url}\n`)
    if (!ADMIN_EMAIL) {
      console.log(`    Tip: set ADMIN_EMAIL=you@example.com to lock the invite to your address.\n`)
    }
  } finally {
    await client.end()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })

/**
 * One-time migration: Samuel's 968 SQLite mobile captures → api Postgres.
 *
 * What it does:
 *   1. Creates 46 Tags under Samuel's Personal Workspace
 *   2. Upserts 968 Blocks from the SQLite backup (type=CAPTURE_POST)
 *   3. Creates BlockTag records for each post's labels
 *   4. Assigns orphaned Blocks (no workspaceId) to Samuel's Personal Workspace
 *   5. Upserts SyncCursor for Samuel + Personal Workspace
 *
 * Usage:
 *   DATABASE_URL="..." npx ts-node --esm scripts/migrate-mobile-captures.ts [--dry-run]
 *
 * Remove this file after successful run.
 */

import { DatabaseSync } from 'node:sqlite'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DRY_RUN = process.argv.includes('--dry-run')

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) { console.error('DATABASE_URL is required'); process.exit(1) }

const SAMUEL_USER_ID = 'cmoq2tqwz000001n6fnjqjzcw'
const SAMUEL_PERSONAL_WORKSPACE_ID = 'cmoq2tqx3000101n6usl2vxbx'
const SQLITE_PATH = path.resolve(__dirname, '../../../tmp/nau-ig-backup-2026-04-11T20-52-09-042Z.db')

interface SqlitePost {
  id: number
  instagramUrl: string
  title: string | null
  content: string | null
  tags: string | null
  frequency: string | null
  mediaData: string | null
  isProcessed: number
  sm2_interval: number
  sm2_repetition: number
  sm2_ease_factor: number
  next_review_at: string | null
  createdAt: string
  sync_status: string
  username: string | null
  profile_image: string | null
  instagram_caption: string | null
  instagram_user_id: string | null
  biography: string | null
}

async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`)

  const sqlite = new DatabaseSync(SQLITE_PATH, { open: true })
  const pg = new Client({ connectionString: DATABASE_URL })
  await pg.connect()

  try {
    const posts = sqlite
      .prepare('SELECT * FROM posts WHERE is_deleted = 0')
      .all() as SqlitePost[]
    const labelRows = sqlite.prepare('SELECT DISTINCT name FROM labels ORDER BY name').all() as { name: string }[]
    const allLabels = labelRows.map(r => r.name)

    console.log(`SQLite: ${posts.length} active posts, ${allLabels.length} labels`)

    if (DRY_RUN) {
      const taggedCount = posts.filter(p => {
        try { return (JSON.parse(p.tags ?? '[]') as unknown[]).length > 0 } catch { return false }
      }).length
      console.log('\n[DRY RUN] Would create:')
      console.log(`  ${allLabels.length} Tags under workspace ${SAMUEL_PERSONAL_WORKSPACE_ID}`)
      console.log(`  ${posts.length} Blocks (type=CAPTURE_POST)`)
      console.log(`  BlockTags for ${taggedCount} posts with labels`)
      console.log('  Orphaned Block workspaceId backfill')
      console.log('  SyncCursor upsert')
      return
    }

    // ── 1. Create Tags ─────────────────────────────────────────────────────────
    console.log('\nCreating tags...')
    const tagMap = new Map<string, string>() // name → id
    const now = new Date().toISOString()

    for (const name of allLabels) {
      const existing = await pg.query<{ id: string }>(
        `SELECT id FROM "Tag" WHERE "workspaceId" = $1 AND name = $2`,
        [SAMUEL_PERSONAL_WORKSPACE_ID, name],
      )
      if (existing.rows.length > 0) {
        tagMap.set(name, existing.rows[0].id)
        continue
      }
      const id = randomUUID().replace(/-/g, '').slice(0, 25)
      await pg.query(
        `INSERT INTO "Tag" (id, "workspaceId", name, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $4)`,
        [id, SAMUEL_PERSONAL_WORKSPACE_ID, name, now],
      )
      tagMap.set(name, id)
    }
    console.log(`  ✓ ${tagMap.size} tags ready`)

    // ── 2. Upsert Blocks ───────────────────────────────────────────────────────
    console.log('\nMigrating posts...')
    let created = 0
    let skipped = 0
    let errors = 0

    for (const post of posts) {
      const uuid = randomUUID()
      const blockId = randomUUID().replace(/-/g, '').slice(0, 25)

      let mediaData: unknown = null
      try { mediaData = post.mediaData ? JSON.parse(post.mediaData) : null } catch { mediaData = null }

      const properties = JSON.stringify({
        instagramUrl: post.instagramUrl,
        title: post.title ?? null,
        content: post.content ?? null,
        username: post.username ?? null,
        profileImage: post.profile_image ?? null,
        instagramCaption: post.instagram_caption ?? null,
        instagramUserId: post.instagram_user_id ?? null,
        biography: post.biography ?? null,
        mediaData,
        syncStatus: post.sync_status,
        smInterval: post.sm2_interval,
        smRepetition: post.sm2_repetition,
        smEaseFactor: post.sm2_ease_factor,
        frequency: post.frequency ?? null,
        nextReviewAt: post.next_review_at ?? null,
        r2Status: null,
      })

      try {
        const result = await pg.query<{ id: string }>(
          `INSERT INTO "Block" (id, uuid, type, properties, "workspaceId", "userId", source, "sourceRef", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $9)
           ON CONFLICT (uuid) DO NOTHING
           RETURNING id`,
          [blockId, uuid, 'CAPTURE_POST', properties, SAMUEL_PERSONAL_WORKSPACE_ID, SAMUEL_USER_ID, 'mobile', String(post.id), new Date(post.createdAt)],
        )

        if (result.rows.length === 0) {
          skipped++
          continue
        }

        const insertedId = result.rows[0].id
        let postTags: string[] = []
        try { postTags = JSON.parse(post.tags ?? '[]') as string[] } catch { postTags = [] }

        for (const tagName of postTags) {
          const tagId = tagMap.get(tagName)
          if (!tagId) continue
          await pg.query(
            `INSERT INTO "BlockTag" ("blockId", "tagId") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [insertedId, tagId],
          )
        }

        created++
        if (created % 100 === 0) console.log(`  ... ${created} posts migrated`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`  ✗ post ${post.id}: ${msg}`)
        errors++
      }
    }

    console.log(`  ✓ ${created} created, ${skipped} skipped (conflict), ${errors} errors`)

    // ── 3. Assign orphaned Blocks ──────────────────────────────────────────────
    console.log('\nAssigning orphaned blocks...')
    const orphan = await pg.query(
      `UPDATE "Block" SET "workspaceId" = $1, "userId" = $2 WHERE "workspaceId" IS NULL`,
      [SAMUEL_PERSONAL_WORKSPACE_ID, SAMUEL_USER_ID],
    )
    console.log(`  ✓ ${orphan.rowCount ?? 0} orphaned blocks assigned`)

    // ── 4. SyncCursor ──────────────────────────────────────────────────────────
    const cursorId = randomUUID().replace(/-/g, '').slice(0, 25)
    await pg.query(
      `INSERT INTO "SyncCursor" (id, "userId", "workspaceId", "lastSyncedAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $4)
       ON CONFLICT ("userId", "workspaceId") DO UPDATE SET "lastSyncedAt" = $4, "updatedAt" = $4`,
      [cursorId, SAMUEL_USER_ID, SAMUEL_PERSONAL_WORKSPACE_ID, new Date()],
    )
    console.log('  ✓ SyncCursor upserted')

    // ── Summary ────────────────────────────────────────────────────────────────
    const { rows: [blockRow] } = await pg.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM "Block" WHERE "workspaceId" = $1 AND type = 'CAPTURE_POST'`,
      [SAMUEL_PERSONAL_WORKSPACE_ID],
    )
    const { rows: [tagRow] } = await pg.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM "Tag" WHERE "workspaceId" = $1`,
      [SAMUEL_PERSONAL_WORKSPACE_ID],
    )
    console.log(`\n✓ Migration complete`)
    console.log(`  CAPTURE_POST blocks in workspace: ${blockRow.count} (expected: ~${posts.length})`)
    console.log(`  Tags in workspace: ${tagRow.count} (expected: ${allLabels.length})`)

  } finally {
    sqlite.close()
    await pg.end()
  }
}

main().catch(e => { console.error(e); process.exit(1) })

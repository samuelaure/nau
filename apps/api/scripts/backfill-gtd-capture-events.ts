/**
 * One-time migration: normalize every existing note into naŭ's root GTD
 * tray, retroactively.
 *
 * Two real bugs compounded into "Bandeja shows nothing": (1) BlockEditor's
 * capture used to call `POST /references/notes` directly, bypassing GTD's
 * capture flow entirely — no note ever created before that fix (nau#153's
 * GTD follow-up) carries a `gtd.capture` movement, so `GET /gtd/tray`
 * correctly reports them as never having entered any tray; (2) a handful of
 * notes still carry the pre-`references.note` legacy shape (`type: 'note'`,
 * `properties: {text, status, date}` — same legacy format nau#107/#138
 * already tracks) and were never migrated onto the current kind at all.
 *
 * This script closes both gaps for every existing row, so Bandeja shows
 * the same notes a user already had before the GTD wiring landed:
 *
 * 1. **Migrate legacy `type: 'note'` rows to `references.note`.** Maps
 *    `properties.text` → `content`, drops `status`/`date` (no equivalent
 *    in `NoteProperties` — those were the legacy kind's own vocabulary,
 *    not references.note's), keeps `sortOrder` (passthrough field the
 *    substrate stamps on every kind, per nau#85). This is a **narrower**
 *    version of nau#138's full legacy-type migration — only `note` rows,
 *    only the fields `NoteProperties` actually declares — not a
 *    replacement for that broader effort.
 * 2. **Record a `gtd.capture` movement for every `references.note`**
 *    (including the ones just migrated in step 1) that has no `gtd.*`
 *    event yet. Each capture is scoped to the note's own `workspaceId` —
 *    confirmed live before running this that notes exist under more than
 *    one workspace, so a single hardcoded trayId/workspaceId pair would
 *    have silently skipped some. `to: ROOT_TRAY_ID` ('root' — the fixed
 *    convention decided 2026-09-04 for naŭ's own root tray, see
 *    apps/app/src/gtd/use-gtd.ts), `from: null`, matching exactly what
 *    `GtdService.capture` itself writes for a fresh capture — this script
 *    intentionally does not call that method (it also creates a new
 *    block, which none of these need) but reproduces its event shape
 *    precisely so `currentTray`/`GET /gtd/tray` treat these identically
 *    to a note captured through the real flow going forward.
 *
 * Idempotent: rows already migrated (real `references.note` kind) or
 * already carrying a `gtd.*` event are left untouched, so a re-run after a
 * partial failure only processes what's still outstanding.
 *
 * Usage:
 *   DATABASE_URL="..." npx ts-node scripts/backfill-gtd-capture-events.ts [--dry-run]
 *
 * Run in every environment that has notes predating this GTD wiring —
 * confirmed necessary in local dev; almost certainly also needed in
 * production, which has been accumulating references.note rows since
 * before this session's GTD work. Remove this file after a successful run
 * against production.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const DRY_RUN = process.argv.includes('--dry-run');

const REFERENCES_NOTE_KIND = 'references.note';
const ROOT_TRAY_ID = 'root';

async function main() {
  // Prisma 7 with a driver adapter needs `new PrismaClient({ adapter })` —
  // it no longer reads DATABASE_URL implicitly from a bare constructor call
  // (confirmed: this script's first draft, copied from
  // migrate-actions-status-vocabulary.ts's pre-Prisma-7 pattern, threw
  // PrismaClientInitializationError). Matches PrismaService's own
  // construction (apps/api/src/prisma/prisma.service.ts).
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    // Step 1 — legacy `type: 'note'` → `references.note`.
    const legacyNotes = await prisma.block.findMany({
      where: { type: 'note', deletedAt: null },
      select: { id: true, properties: true, workspaceId: true },
    });

    console.log(`Found ${legacyNotes.length} legacy 'note' block(s) to migrate to '${REFERENCES_NOTE_KIND}'.`);
    for (const block of legacyNotes) {
      const props = (block.properties ?? {}) as Record<string, unknown>;
      console.log(`  ${block.id} — "${String(props.text ?? '').slice(0, 60)}"`);
    }

    if (!DRY_RUN) {
      for (const block of legacyNotes) {
        const props = (block.properties ?? {}) as Record<string, unknown>;
        // NoteSchema's own fields only — status/date belonged to the legacy
        // kind's vocabulary, not references.note's (NoteSchema has no
        // matching field for either). sortOrder is kept: it's a substrate-
        // stamped passthrough field every kind carries (nau#85), not this
        // kind's own business, but dropping it here would be an unrelated
        // regression for whatever already orders by it.
        const migratedProperties = {
          title: null,
          content: typeof props.text === 'string' ? props.text : '',
          attachments: [] as unknown[],
          suggestedType: null,
          ...(props.sortOrder !== undefined ? { sortOrder: props.sortOrder as number } : {}),
        };
        await prisma.block.update({
          where: { id: block.id },
          data: { type: REFERENCES_NOTE_KIND, properties: migratedProperties as Prisma.InputJsonValue },
        });
      }
      console.log(`Migrated ${legacyNotes.length} legacy 'note' block(s).\n`);
    } else {
      console.log('--dry-run: step 1 skipped.\n');
    }

    // Step 2 — a gtd.capture event for every references.note with none yet.
    // Re-queried after step 1 (not reusing legacyNotes) so a note migrated
    // above is picked up in the same run without a second invocation.
    const uncapturedNotes = await prisma.$queryRaw<
      Array<{ id: string; workspaceId: string | null; userId: string | null }>
    >`
      SELECT b.id, b."workspaceId", b."userId"
      FROM "Block" b
      WHERE b.type = ${REFERENCES_NOTE_KIND}
        AND b."deletedAt" IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM "Event" e WHERE e."blockId" = b.id AND e.type LIKE 'gtd.%'
        )
      ORDER BY b."createdAt"
    `;

    console.log(`Found ${uncapturedNotes.length} '${REFERENCES_NOTE_KIND}' block(s) with no gtd.* event.`);
    const missingWorkspace = uncapturedNotes.filter((n) => !n.workspaceId);
    if (missingWorkspace.length > 0) {
      console.log(
        `  WARNING: ${missingWorkspace.length} block(s) have no workspaceId at all — skipped, since ` +
          `Event.workspaceId (nau#125's own fix) has nothing real to stamp: ${missingWorkspace.map((n) => n.id).join(', ')}`,
      );
    }
    const toCapture = uncapturedNotes.filter((n) => n.workspaceId);
    for (const note of toCapture) {
      console.log(`  ${note.id} (workspace ${note.workspaceId})`);
    }

    if (DRY_RUN) {
      console.log('\n--dry-run: step 2 skipped. No writes performed.');
      return;
    }

    for (const note of toCapture) {
      await prisma.event.create({
        data: {
          blockId: note.id,
          type: 'gtd.capture',
          metadata: { from: null, to: ROOT_TRAY_ID },
          workspaceId: note.workspaceId,
          userId: note.userId,
        },
      });
    }

    console.log(`\nRecorded gtd.capture for ${toCapture.length} block(s) into tray '${ROOT_TRAY_ID}'.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * One-time migration: normalise Actions' `properties.status` vocabulary.
 *
 * `'completed'` and `'done'` have coexisted as spellings of the same outcome —
 * nothing in the codebase writes `'completed'` any more (confirmed by search,
 * 2026-08-30), but rows written before that stopped still carry it. This
 * migration rewrites those rows to the canonical `'done'`, per nau#101.
 *
 * Scope: only `action`, `habit`, `project`, `appointment`, `someday_maybe` —
 * Actions' own types. Other modules' blocks are left untouched even if one
 * happens to carry `status: 'completed'` for an unrelated reason.
 *
 * Usage:
 *   DATABASE_URL="..." npx ts-node scripts/migrate-actions-status-vocabulary.ts [--dry-run]
 *
 * Remove this file after a successful run against production.
 */

import { PrismaClient } from '@prisma/client';

const DRY_RUN = process.argv.includes('--dry-run');

const ACTIONS_TYPES = ['action', 'habit', 'project', 'appointment', 'someday_maybe'];

async function main() {
  const prisma = new PrismaClient();

  try {
    const candidates = await prisma.block.findMany({
      where: {
        type: { in: ACTIONS_TYPES },
        deletedAt: null,
        properties: { path: ['status'], equals: 'completed' },
      },
      select: { id: true, type: true, properties: true },
    });

    console.log(`Found ${candidates.length} block(s) with status: 'completed'.`);

    if (candidates.length === 0) {
      console.log('Nothing to migrate.');
      return;
    }

    for (const block of candidates) {
      console.log(`  ${block.type} ${block.id}`);
    }

    if (DRY_RUN) {
      console.log('\n--dry-run: no writes performed.');
      return;
    }

    for (const block of candidates) {
      const props = (block.properties ?? {}) as Record<string, unknown>;
      await prisma.block.update({
        where: { id: block.id },
        data: { properties: { ...props, status: 'done' } },
      });
    }

    console.log(`\nMigrated ${candidates.length} block(s) to status: 'done'.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

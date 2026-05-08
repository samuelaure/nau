/**
 * One-time migration: add production/ prefix to all nauthenticity R2 objects
 * and update all DB URLs to match.
 * CJS script for execution inside the nauthenticity Docker container.
 *
 * Usage: node /tmp/migrate-r2.cjs
 */

'use strict';

const {
  S3Client,
  ListObjectsV2Command,
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
} = require('/app/apps/nauthenticity/node_modules/@aws-sdk/client-s3');

const { Client } = require('/app/node_modules/.pnpm/pg@8.20.0/node_modules/pg/lib/index.js');

const BUCKET = process.env.R2_BUCKET_NAME;
const PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
const DATABASE_URL = process.env.DATABASE_URL;

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async function listAll(prefix) {
  const keys = [];
  let token;
  do {
    const r = await r2.send(new ListObjectsV2Command({
      Bucket: BUCKET, Prefix: prefix, MaxKeys: 1000, ContinuationToken: token,
    }));
    (r.Contents || []).forEach(o => keys.push(o.Key));
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

async function objectExists(key) {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function deleteObjects(keys) {
  if (keys.length === 0) return;
  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000);
    await r2.send(new DeleteObjectsCommand({
      Bucket: BUCKET,
      Delete: { Objects: batch.map(k => ({ Key: k })), Quiet: true },
    }));
  }
}

async function main() {
  console.log('=== R2 Production Prefix Migration ===\n');

  if (!BUCKET || !PUBLIC_URL || !DATABASE_URL) {
    throw new Error('Missing env vars: R2_BUCKET_NAME, R2_PUBLIC_URL, DATABASE_URL');
  }

  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();

  try {
    // -----------------------------------------------------------------------
    // Step 1: List all current objects under nauthenticity/
    // -----------------------------------------------------------------------
    console.log('Step 1: Listing R2 objects under nauthenticity/...');
    const oldKeys = await listAll('nauthenticity/');
    console.log(`  Found ${oldKeys.length} objects`);

    // -----------------------------------------------------------------------
    // Step 2: Copy each to production/nauthenticity/...
    // -----------------------------------------------------------------------
    console.log('\nStep 2: Copying to production/nauthenticity/...');
    let copied = 0;
    let skipped = 0;
    for (let i = 0; i < oldKeys.length; i++) {
      const oldKey = oldKeys[i];
      const newKey = `production/${oldKey}`;
      if (await objectExists(newKey)) {
        skipped++;
      } else {
        await r2.send(new CopyObjectCommand({
          Bucket: BUCKET,
          CopySource: `${BUCKET}/${oldKey}`,
          Key: newKey,
        }));
        copied++;
      }
      if ((i + 1) % 25 === 0 || i === oldKeys.length - 1) {
        process.stdout.write(`  ${i + 1}/${oldKeys.length} (copied=${copied} skipped=${skipped})\r`);
      }
    }
    console.log(`\n  Done. Copied: ${copied}, already existed (skipped): ${skipped}`);

    // -----------------------------------------------------------------------
    // Step 3: Update DB URLs
    // -----------------------------------------------------------------------
    const OLD_BASE = `${PUBLIC_URL}/nauthenticity/`;
    const NEW_BASE = `${PUBLIC_URL}/production/nauthenticity/`;

    console.log('\nStep 3: Updating DB URLs...');
    console.log(`  Old base: ${OLD_BASE}`);
    console.log(`  New base: ${NEW_BASE}`);

    const r1 = await db.query(
      `UPDATE "Media" SET "storageUrl" = REPLACE("storageUrl", $1, $2) WHERE "storageUrl" LIKE $3`,
      [OLD_BASE, NEW_BASE, OLD_BASE + '%']
    );
    console.log(`  Media.storageUrl: ${r1.rowCount} rows updated`);

    const r2q = await db.query(
      `UPDATE "Media" SET "thumbnailUrl" = REPLACE("thumbnailUrl", $1, $2) WHERE "thumbnailUrl" LIKE $3`,
      [OLD_BASE, NEW_BASE, OLD_BASE + '%']
    );
    console.log(`  Media.thumbnailUrl: ${r2q.rowCount} rows updated`);

    const r3 = await db.query(
      `UPDATE "SocialProfile" SET "profileImageUrl" = REPLACE("profileImageUrl", $1, $2) WHERE "profileImageUrl" LIKE $3`,
      [OLD_BASE, NEW_BASE, OLD_BASE + '%']
    );
    console.log(`  SocialProfile.profileImageUrl: ${r3.rowCount} rows updated`);

    // -----------------------------------------------------------------------
    // Step 4: Collect DB-referenced keys to find orphans
    // -----------------------------------------------------------------------
    console.log('\nStep 4: Collecting DB-referenced R2 keys...');
    const mediaRows = await db.query(`SELECT "storageUrl", "thumbnailUrl" FROM "Media"`);
    const profileRows = await db.query(`SELECT "profileImageUrl" FROM "SocialProfile"`);

    const referencedKeys = new Set();
    const prefixedBase = `${PUBLIC_URL}/production/`;
    for (const row of mediaRows.rows) {
      if (row.storageUrl && row.storageUrl.startsWith(prefixedBase)) {
        referencedKeys.add(row.storageUrl.slice(PUBLIC_URL.length + 1));
      }
      if (row.thumbnailUrl && row.thumbnailUrl.startsWith(prefixedBase)) {
        referencedKeys.add(row.thumbnailUrl.slice(PUBLIC_URL.length + 1));
      }
    }
    for (const row of profileRows.rows) {
      if (row.profileImageUrl && row.profileImageUrl.startsWith(prefixedBase)) {
        referencedKeys.add(row.profileImageUrl.slice(PUBLIC_URL.length + 1));
      }
    }
    console.log(`  DB references ${referencedKeys.size} unique R2 keys`);

    // -----------------------------------------------------------------------
    // Step 5: Find and delete orphaned objects under production/nauthenticity/
    // -----------------------------------------------------------------------
    console.log('\nStep 5: Checking for orphaned objects under production/nauthenticity/...');
    const newKeys = await listAll('production/nauthenticity/');
    const orphans = newKeys.filter(k => !referencedKeys.has(k));
    console.log(`  Total new keys: ${newKeys.length}`);
    console.log(`  Orphaned (not in DB): ${orphans.length}`);
    if (orphans.length > 0) {
      console.log('  Orphaned keys:');
      orphans.forEach(k => console.log(`    ${k}`));
      console.log('  Deleting orphans...');
      await deleteObjects(orphans);
      console.log('  Deleted.');
    }

    // -----------------------------------------------------------------------
    // Step 6: Delete old nauthenticity/ objects
    // -----------------------------------------------------------------------
    console.log('\nStep 6: Deleting old nauthenticity/ objects...');
    await deleteObjects(oldKeys);
    console.log(`  Deleted ${oldKeys.length} old objects`);

    // -----------------------------------------------------------------------
    // Step 7: Verification
    // -----------------------------------------------------------------------
    console.log('\n=== Verification ===');

    const verify = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE "storageUrl" LIKE $1) AS storage_new,
        COUNT(*) FILTER (WHERE "storageUrl" LIKE $2) AS storage_old,
        COUNT(*) FILTER (WHERE "thumbnailUrl" LIKE $1) AS thumb_new,
        COUNT(*) FILTER (WHERE "thumbnailUrl" LIKE $2) AS thumb_old
      FROM "Media"
    `, [NEW_BASE + '%', OLD_BASE + '%']);

    const verifyProfile = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE "profileImageUrl" LIKE $1) AS pic_new,
        COUNT(*) FILTER (WHERE "profileImageUrl" LIKE $2) AS pic_old
      FROM "SocialProfile"
    `, [NEW_BASE + '%', OLD_BASE + '%']);

    const m = verify.rows[0];
    const p = verifyProfile.rows[0];
    console.log(`Media storageUrl   : new=${m.storage_new}  old=${m.storage_old}`);
    console.log(`Media thumbnailUrl : new=${m.thumb_new}  old=${m.thumb_old}`);
    console.log(`Profile pic        : new=${p.pic_new}  old=${p.pic_old}`);

    const remaining = await listAll('nauthenticity/');
    const finalNew = await listAll('production/nauthenticity/');
    console.log(`Old R2 (nauthenticity/)                   : ${remaining.length} objects`);
    console.log(`New R2 (production/nauthenticity/)        : ${finalNew.length} objects`);

    const allGood =
      Number(m.storage_old) === 0 &&
      Number(m.thumb_old) === 0 &&
      Number(p.pic_old) === 0 &&
      remaining.length === 0;

    if (allGood) {
      console.log('\n✅ Migration complete and verified.');
    } else {
      console.log('\n⚠️  Some items still on old prefix — check output above.');
    }

  } finally {
    await db.end();
  }
}

main().catch(err => {
  console.error('\nMigration failed:', err.message);
  process.exit(1);
});

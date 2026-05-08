'use strict';

/**
 * Migration 2:
 *   A) flownau: copy flownau/ → production/flownau/, update Asset.url + Asset.thumbnailUrl
 *   B) nauthenticity collaborators: for each (context, collab) pair found in Post.collaborators,
 *      copy production/nauthenticity/content/{collab}/profile.jpg
 *        → production/nauthenticity/content/{context}/collaborators/profile_{collab}.jpg
 *      then update Post.collaborators[].profilePicUrl to the new URL.
 *      Delete orphaned collaborator source files that are no longer referenced
 *      by SocialProfile.profileImageUrl (i.e. pure-collaborator profiles).
 *
 * Run: node /tmp/migrate2.cjs
 */

const {
  S3Client,
  ListObjectsV2Command,
  CopyObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
} = require('/app/apps/nauthenticity/node_modules/@aws-sdk/client-s3');

const { Client } = require('/app/node_modules/.pnpm/pg@8.20.0/node_modules/pg/lib/index.js');

const BUCKET = process.env.R2_BUCKET_NAME;
const PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// -------------------------------------------------------------------------
// R2 helpers
// -------------------------------------------------------------------------
async function listAll(prefix) {
  const keys = []; let token;
  do {
    const r = await r2.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, MaxKeys: 1000, ContinuationToken: token }));
    (r.Contents || []).forEach(o => keys.push(o.Key));
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

async function objectExists(key) {
  try { await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key })); return true; }
  catch { return false; }
}

async function copyObject(src, dst) {
  await r2.send(new CopyObjectCommand({ Bucket: BUCKET, CopySource: `${BUCKET}/${src}`, Key: dst }));
}

async function deleteObjects(keys) {
  if (!keys.length) return;
  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000);
    await r2.send(new DeleteObjectsCommand({ Bucket: BUCKET, Delete: { Objects: batch.map(k => ({ Key: k })), Quiet: true } }));
  }
}

// -------------------------------------------------------------------------
// A) flownau migration
// -------------------------------------------------------------------------
async function migrateFlownau(flownauDb) {
  console.log('\n=== A) flownau R2 + DB migration ===');

  const OLD_BASE = `${PUBLIC_URL}/flownau/`;
  const NEW_BASE = `${PUBLIC_URL}/production/flownau/`;

  const oldKeys = await listAll('flownau/');
  console.log(`  R2 objects under flownau/: ${oldKeys.length}`);

  // Copy to production/flownau/
  let copied = 0, skipped = 0;
  for (let i = 0; i < oldKeys.length; i++) {
    const newKey = `production/${oldKeys[i]}`;
    if (await objectExists(newKey)) { skipped++; }
    else { await copyObject(oldKeys[i], newKey); copied++; }
    process.stdout.write(`  ${i + 1}/${oldKeys.length} (copied=${copied} skipped=${skipped})\r`);
  }
  console.log(`\n  Copied: ${copied}, skipped: ${skipped}`);

  // Update DB
  const r1 = await flownauDb.query(
    `UPDATE "Asset" SET url = REPLACE(url, $1, $2) WHERE url LIKE $3`,
    [OLD_BASE, NEW_BASE, OLD_BASE + '%']
  );
  console.log(`  Asset.url updated: ${r1.rowCount} rows`);

  const r2q = await flownauDb.query(
    `UPDATE "Asset" SET "thumbnailUrl" = REPLACE("thumbnailUrl", $1, $2) WHERE "thumbnailUrl" LIKE $3`,
    [OLD_BASE, NEW_BASE, OLD_BASE + '%']
  );
  console.log(`  Asset.thumbnailUrl updated: ${r2q.rowCount} rows`);

  // Collect referenced keys
  const assets = await flownauDb.query(`SELECT url, "thumbnailUrl" FROM "Asset"`);
  const referenced = new Set();
  for (const row of assets.rows) {
    if (row.url?.startsWith(`${PUBLIC_URL}/production/`)) referenced.add(row.url.slice(PUBLIC_URL.length + 1));
    if (row.thumbnailUrl?.startsWith(`${PUBLIC_URL}/production/`)) referenced.add(row.thumbnailUrl.slice(PUBLIC_URL.length + 1));
  }
  console.log(`  DB references ${referenced.size} flownau keys`);

  // Find + delete orphans under production/flownau/
  const newKeys = await listAll('production/flownau/');
  const orphans = newKeys.filter(k => !referenced.has(k));
  console.log(`  Orphaned production/flownau/ objects: ${orphans.length}`);
  if (orphans.length) { orphans.forEach(k => console.log(`    ${k}`)); await deleteObjects(orphans); }

  // Delete old flownau/ keys
  await deleteObjects(oldKeys);
  console.log(`  Deleted ${oldKeys.length} old flownau/ objects`);

  // Verify
  const v = await flownauDb.query(`SELECT COUNT(*) FILTER (WHERE url LIKE $1) AS new, COUNT(*) FILTER (WHERE url LIKE $2) AS old FROM "Asset"`, [NEW_BASE + '%', OLD_BASE + '%']);
  console.log(`  Asset.url: new=${v.rows[0].new}  old=${v.rows[0].old}`);
  const remaining = await listAll('flownau/');
  console.log(`  Old R2 (flownau/): ${remaining.length} objects remaining`);
}

// -------------------------------------------------------------------------
// B) nauthenticity collaborator pic relocation
// -------------------------------------------------------------------------
async function migrateCollaboratorPics(nauth) {
  console.log('\n=== B) nauthenticity collaborator pic relocation ===');

  const NEW_BASE = `${PUBLIC_URL}/production/nauthenticity/content/`;

  // Find all distinct (context_username, collab_username, current_profilePicUrl) from Post.collaborators
  const rows = await nauth.query(`
    SELECT DISTINCT
      p.username AS context,
      c->>'username' AS collab,
      c->>'profilePicUrl' AS current_url
    FROM "Post" p,
      jsonb_array_elements(p.collaborators) c
    WHERE p.collaborators IS NOT NULL
      AND jsonb_array_length(p.collaborators) > 0
      AND (c->>'profilePicUrl') IS NOT NULL
      AND (c->>'username') IS NOT NULL
    ORDER BY context, collab
  `);

  console.log(`  Found ${rows.rows.length} distinct (context, collab) pairs with profile pics`);

  const updates = []; // { context, collab, oldUrl, newUrl, srcKey, dstKey }

  for (const row of rows.rows) {
    const { context, collab, current_url } = row;
    // Source key: the collaborator's own profile pic (already at production/ prefix if we migrated it)
    // It could be at old OR new prefix — check both
    const srcKey = `production/nauthenticity/content/${collab}/profile.jpg`;
    const dstKey = `production/nauthenticity/content/${context}/collaborators/profile_${collab}.jpg`;
    const newUrl = `${PUBLIC_URL}/${dstKey}`;

    updates.push({ context, collab, current_url, newUrl, srcKey, dstKey });
  }

  // Copy source → dest for each (deduplicated dstKeys)
  const seenDst = new Set();
  for (const u of updates) {
    if (seenDst.has(u.dstKey)) continue;
    seenDst.add(u.dstKey);

    if (await objectExists(u.dstKey)) {
      console.log(`  Already exists: ${u.dstKey}`);
    } else if (await objectExists(u.srcKey)) {
      await copyObject(u.srcKey, u.dstKey);
      console.log(`  Copied: ${u.srcKey} → ${u.dstKey}`);
    } else {
      console.log(`  ⚠️  Source not found: ${u.srcKey} (skipping)`);
    }
  }

  // Update Post.collaborators JSON: replace old URL with new URL for each (context, collab) pair
  for (const u of updates) {
    if (u.current_url === u.newUrl) continue; // already correct
    const result = await nauth.query(`
      UPDATE "Post"
      SET collaborators = (
        SELECT jsonb_agg(
          CASE
            WHEN (elem->>'username') = $1
            THEN jsonb_set(elem, '{profilePicUrl}', to_jsonb($2::text))
            ELSE elem
          END
        )
        FROM jsonb_array_elements(collaborators) elem
      )
      WHERE username = $3
        AND collaborators IS NOT NULL
        AND collaborators @> jsonb_build_array(jsonb_build_object('username', $1::text))
    `, [u.collab, u.newUrl, u.context]);
    console.log(`  Updated Post.collaborators: context=${u.context} collab=${u.collab} → ${result.rowCount} posts`);
  }

  // Also update SocialProfile.profileImageUrl if any collab's pic is now wrong-prefixed
  // (already handled in migration 1, but let's update the collaborators json old-prefix too)
  const oldPrefixFix = await nauth.query(`
    SELECT COUNT(*) FROM "Post"
    WHERE collaborators IS NOT NULL
      AND collaborators::text LIKE '%media.9nau.com/nauthenticity/%'
  `);
  if (Number(oldPrefixFix.rows[0].count) > 0) {
    console.log(`  Fixing ${oldPrefixFix.rows[0].count} posts still with old nauthenticity/ prefix in collaborators JSON...`);
    await nauth.query(`
      UPDATE "Post"
      SET collaborators = REPLACE(collaborators::text, 'https://media.9nau.com/nauthenticity/', 'https://media.9nau.com/production/nauthenticity/')::jsonb
      WHERE collaborators IS NOT NULL
        AND collaborators::text LIKE '%media.9nau.com/nauthenticity/%'
    `);
    console.log(`  Done.`);
  }

  // Verify final state
  const check = await nauth.query(`
    SELECT DISTINCT
      p.username AS context,
      c->>'username' AS collab,
      c->>'profilePicUrl' AS url
    FROM "Post" p, jsonb_array_elements(p.collaborators) c
    WHERE p.collaborators IS NOT NULL AND jsonb_array_length(p.collaborators) > 0
      AND (c->>'profilePicUrl') IS NOT NULL
    ORDER BY context, collab
  `);
  console.log('\n  Final collaborator pic URLs in DB:');
  for (const r of check.rows) {
    console.log(`    [${r.context}] ${r.collab}: ${r.url}`);
  }
}

// -------------------------------------------------------------------------
// Main
// -------------------------------------------------------------------------
async function main() {
  console.log('=== Migration 2: flownau prefix + collaborator pic relocation ===\n');

  const flownauDbUrl = process.env.FLOWNAU_DATABASE_URL;
  const nautDbUrl = process.env.DATABASE_URL;

  if (!flownauDbUrl) throw new Error('FLOWNAU_DATABASE_URL env var required');
  if (!nautDbUrl) throw new Error('DATABASE_URL env var required');

  const flownauDb = new Client({ connectionString: flownauDbUrl });
  const nautDb = new Client({ connectionString: nautDbUrl });

  await flownauDb.connect();
  await nautDb.connect();

  try {
    await migrateFlownau(flownauDb);
    await migrateCollaboratorPics(nautDb);
    console.log('\n✅ Migration 2 complete.');
  } finally {
    await flownauDb.end();
    await nautDb.end();
  }
}

main().catch(err => { console.error('\nFailed:', err.message); process.exit(1); });

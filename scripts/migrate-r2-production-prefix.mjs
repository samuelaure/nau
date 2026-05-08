/**
 * One-time migration: add production/ prefix to all nauthenticity R2 objects
 * and update all DB URLs to match.
 *
 * Run on the server via:
 *   node /tmp/migrate-r2.mjs
 *
 * What this does:
 *   1. List all objects under nauthenticity/ in R2
 *   2. Copy each to production/nauthenticity/...
 *   3. Delete the old nauthenticity/... key
 *   4. Update Media.storageUrl, Media.thumbnailUrl, SocialProfile.profileImageUrl in DB
 *   5. Delete R2 objects (under production/) not referenced by any DB record
 *
 * Safe to re-run: copy is idempotent, DB update is idempotent.
 */

import {
  S3Client,
  ListObjectsV2Command,
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME;
const PUBLIC_URL = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

async function listAll(prefix) {
  const keys = [];
  let token;
  do {
    const r = await r2.send(new ListObjectsV2Command({
      Bucket: BUCKET, Prefix: prefix, MaxKeys: 1000, ContinuationToken: token,
    }));
    (r.Contents ?? []).forEach(o => keys.push(o.Key));
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

async function copyObject(srcKey, dstKey) {
  await r2.send(new CopyObjectCommand({
    Bucket: BUCKET,
    CopySource: `${BUCKET}/${srcKey}`,
    Key: dstKey,
  }));
}

async function deleteObjects(keys) {
  if (keys.length === 0) return;
  // R2 DeleteObjects supports up to 1000 at a time
  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000);
    await r2.send(new DeleteObjectsCommand({
      Bucket: BUCKET,
      Delete: { Objects: batch.map(k => ({ Key: k })), Quiet: true },
    }));
  }
}

// -------------------------------------------------------------------------
// Main
// -------------------------------------------------------------------------

async function main() {
  console.log('=== R2 Production Prefix Migration ===\n');

  // Step 1: List all current objects under nauthenticity/
  console.log('Listing R2 objects under nauthenticity/...');
  const oldKeys = await listAll('nauthenticity/');
  console.log(`Found ${oldKeys.length} objects\n`);

  // Step 2: Copy each object to production/nauthenticity/...
  console.log('Copying objects to production/nauthenticity/...');
  let copied = 0;
  let alreadyExists = 0;
  for (const oldKey of oldKeys) {
    const newKey = `production/${oldKey}`;
    // Check if already copied (idempotency)
    try {
      await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: newKey }));
      alreadyExists++;
    } catch {
      await copyObject(oldKey, newKey);
      copied++;
    }
    if ((copied + alreadyExists) % 50 === 0) {
      process.stdout.write(`  ${copied + alreadyExists}/${oldKeys.length}...\r`);
    }
  }
  console.log(`\nCopied: ${copied}, already existed: ${alreadyExists}`);

  // Step 3: Update DB URLs
  console.log('\nUpdating DB URLs...');

  const OLD_BASE = `${PUBLIC_URL}/nauthenticity/`;
  const NEW_BASE = `${PUBLIC_URL}/production/nauthenticity/`;

  // Media.storageUrl
  const mediaStorageResult = await prisma.$executeRaw`
    UPDATE "Media"
    SET "storageUrl" = REPLACE("storageUrl", ${OLD_BASE}, ${NEW_BASE})
    WHERE "storageUrl" LIKE ${OLD_BASE + '%'}
  `;
  console.log(`  Media.storageUrl updated: ${mediaStorageResult} rows`);

  // Media.thumbnailUrl
  const mediaThumbnailResult = await prisma.$executeRaw`
    UPDATE "Media"
    SET "thumbnailUrl" = REPLACE("thumbnailUrl", ${OLD_BASE}, ${NEW_BASE})
    WHERE "thumbnailUrl" LIKE ${OLD_BASE + '%'}
  `;
  console.log(`  Media.thumbnailUrl updated: ${mediaThumbnailResult} rows`);

  // SocialProfile.profileImageUrl
  const profileResult = await prisma.$executeRaw`
    UPDATE "SocialProfile"
    SET "profileImageUrl" = REPLACE("profileImageUrl", ${OLD_BASE}, ${NEW_BASE})
    WHERE "profileImageUrl" LIKE ${OLD_BASE + '%'}
  `;
  console.log(`  SocialProfile.profileImageUrl updated: ${profileResult} rows`);

  // Step 4: Collect all DB-referenced R2 keys (new prefix form)
  console.log('\nCollecting DB-referenced R2 keys...');
  const dbStorageUrls = await prisma.media.findMany({
    select: { storageUrl: true, thumbnailUrl: true },
  });
  const dbProfileUrls = await prisma.socialProfile.findMany({
    select: { profileImageUrl: true },
  });

  const referencedKeys = new Set();
  for (const m of dbStorageUrls) {
    if (m.storageUrl?.startsWith(`${PUBLIC_URL}/production/`)) {
      referencedKeys.add(m.storageUrl.slice(PUBLIC_URL.length + 1)); // strip https://media.9nau.com/
    }
    if (m.thumbnailUrl?.startsWith(`${PUBLIC_URL}/production/`)) {
      referencedKeys.add(m.thumbnailUrl.slice(PUBLIC_URL.length + 1));
    }
  }
  for (const p of dbProfileUrls) {
    if (p.profileImageUrl?.startsWith(`${PUBLIC_URL}/production/`)) {
      referencedKeys.add(p.profileImageUrl.slice(PUBLIC_URL.length + 1));
    }
  }
  console.log(`  DB references ${referencedKeys.size} unique R2 keys`);

  // Step 5: List all objects under production/nauthenticity/ and find orphans
  console.log('\nListing R2 objects under production/nauthenticity/...');
  const newKeys = await listAll('production/nauthenticity/');
  console.log(`Found ${newKeys.length} objects`);

  const orphanedNewKeys = newKeys.filter(k => !referencedKeys.has(k));
  console.log(`\nOrphaned R2 objects (not in DB): ${orphanedNewKeys.length}`);
  if (orphanedNewKeys.length > 0) {
    console.log('  Orphaned keys:');
    orphanedNewKeys.forEach(k => console.log(`    ${k}`));
    console.log('\n  Deleting orphaned objects...');
    await deleteObjects(orphanedNewKeys);
    console.log('  Done.');
  }

  // Step 6: Delete the old nauthenticity/ objects
  console.log('\nDeleting old nauthenticity/ objects...');
  await deleteObjects(oldKeys);
  console.log(`Deleted ${oldKeys.length} old objects`);

  // Step 7: Final verification
  console.log('\n=== Verification ===');
  const [mediaStats, profileStats] = await Promise.all([
    prisma.$queryRaw`
      SELECT
        COUNT(*) FILTER (WHERE "storageUrl" LIKE 'https://media.9nau.com/production/%') AS storage_new,
        COUNT(*) FILTER (WHERE "storageUrl" LIKE 'https://media.9nau.com/nauthenticity/%') AS storage_old,
        COUNT(*) FILTER (WHERE "thumbnailUrl" LIKE 'https://media.9nau.com/production/%') AS thumb_new,
        COUNT(*) FILTER (WHERE "thumbnailUrl" LIKE 'https://media.9nau.com/nauthenticity/%') AS thumb_old
      FROM "Media"
    `,
    prisma.$queryRaw`
      SELECT
        COUNT(*) FILTER (WHERE "profileImageUrl" LIKE 'https://media.9nau.com/production/%') AS pic_new,
        COUNT(*) FILTER (WHERE "profileImageUrl" LIKE 'https://media.9nau.com/nauthenticity/%') AS pic_old
      FROM "SocialProfile"
    `,
  ]);

  const m = mediaStats[0];
  const p = profileStats[0];
  console.log(`Media storageUrl   : new=${m.storage_new} old=${m.storage_old}`);
  console.log(`Media thumbnailUrl : new=${m.thumb_new}   old=${m.thumb_old}`);
  console.log(`Profile pic        : new=${p.pic_new}     old=${p.pic_old}`);

  const remaining = await listAll('nauthenticity/');
  console.log(`Old R2 keys remaining (nauthenticity/): ${remaining.length}`);
  const finalNew = await listAll('production/nauthenticity/');
  console.log(`New R2 keys (production/nauthenticity/): ${finalNew.length}`);

  if (Number(m.storage_old) === 0 && Number(m.thumb_old) === 0 && Number(p.pic_old) === 0 && remaining.length === 0) {
    console.log('\n✅ Migration complete and verified.');
  } else {
    console.log('\n⚠️  Some items still on old prefix — check output above.');
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

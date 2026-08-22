/**
 * One-off backfill: reprocesses the 98 naŭ mobile captures stuck in
 * "Syncing Media..." because the app never had a media-ingestion path.
 *
 * Runs OUTSIDE the app — against a local copy of the mobile SQLite database
 * (pulled over adb), calling production nauthenticity over HTTPS with a
 * self-signed service token. Nothing here runs inside a container, and mobile
 * itself is never touched: it has no working user auth yet (pre-Phase-9), so
 * this is deliberately a script, not a new app feature. See
 * nau-mobile/docs/reprocessing-pipeline.md and the "how to run" note at the
 * bottom of this file.
 *
 * Two modes, kept separate on purpose — deletion is the only irreversible
 * step and must never happen as a side effect of reprocessing:
 *
 *   reprocess   — scrapes every pending post, writes back mediaData for posts
 *                 that still exist, and REPORTS (never deletes) posts that no
 *                 longer resolve on Instagram.
 *   apply-deletions --ids 12,45  — deletes exactly the ids you pass, after
 *                 you've reviewed the report and (for any post the report
 *                 couldn't prove was actually deleted vs. merely restricted)
 *                 checked the URL by hand.
 */
import { DatabaseSync } from 'node:sqlite';
import { signServiceToken } from '@nau/auth';

const NAUTHENTICITY_URL = process.env.NAUTHENTICITY_URL ?? 'https://nauthenticity.9nau.com';
const AUTH_SECRET = process.env.AUTH_SECRET;
const DB_PATH = process.env.MOBILE_DB_PATH;
const DEFAULT_TITLE = 'Instagram Capture';
const POLL_INTERVAL_MS = 5000;
// HEVC CRF36 at native res with preset:medium on a modest VPS CPU can genuinely
// run past 15 minutes for a long/large video. Confirmed on the real batch:
// once one job ran long, giving up and enqueuing the next post (concurrency:1
// worker) meant every subsequent post inherited the growing backlog delay —
// a cascade of "timeouts" that were really just queue wait, not failures, and
// each abandoned-but-still-running job wasted its own completed work since
// the script never came back to record it. This is a one-off background
// script with nobody waiting on wall-clock time per post, so there is no
// reason to give up early at all — a long timeout here only exists as a
// backstop against a genuinely stuck job, which BullMQ's own lockDuration/
// stalledInterval already catches independently.
const POLL_TIMEOUT_MS = 60 * 60 * 1000;

interface MobilePost {
  id: number;
  instagramUrl: string;
  title: string | null;
  content: string | null;
}

interface ReprocessedMedia {
  type: 'image' | 'video';
  storageUrl: string;
  width: number | null;
  height: number | null;
  index: number;
}

type JobResult =
  | {
      outcome: 'found';
      postUrl: string;
      username: string | null;
      caption: string | null;
      postedAt: string;
      media: ReprocessedMedia[];
    }
  | { outcome: 'not_found'; postUrl: string };

async function serviceHeaders(): Promise<Record<string, string>> {
  if (!AUTH_SECRET) throw new Error('AUTH_SECRET env var is required (same secret as nauthenticity/.env)');
  const token = await signServiceToken({ iss: 'mobile-reprocess-script', aud: 'nauthenticity', secret: AUTH_SECRET });
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function enqueue(url: string): Promise<string> {
  const res = await fetch(`${NAUTHENTICITY_URL}/api/v1/_service/mobile/process-capture`, {
    method: 'POST',
    headers: await serviceHeaders(),
    body: JSON.stringify({ url }),
  });
  if (!res.ok) throw new Error(`enqueue ${url} → ${res.status}: ${await res.text()}`);
  const body = await res.json();
  return body.jobId;
}

async function pollUntilDone(jobId: string): Promise<JobResult> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const res = await fetch(`${NAUTHENTICITY_URL}/api/v1/_service/mobile/process-capture/${jobId}`, {
      headers: await serviceHeaders(),
    });
    if (!res.ok) throw new Error(`status ${jobId} → ${res.status}: ${await res.text()}`);
    const body = await res.json();
    if (body.state === 'completed') return body.result as JobResult;
    if (body.state === 'failed') throw new Error(body.failedReason ?? 'job failed');
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`timed out waiting for job ${jobId}`);
}

function hasCustomTitleOrNote(post: MobilePost): boolean {
  const hasTitle = !!post.title && post.title !== DEFAULT_TITLE;
  const hasNote = !!post.content && post.content.trim().length > 0;
  return hasTitle || hasNote;
}

async function runReprocess(db: DatabaseSync) {
  const pending = db
    .prepare(`SELECT id, instagramUrl, title, content FROM posts WHERE isProcessed = 0 AND instagramUrl IS NOT NULL AND instagramUrl != ''`)
    .all() as unknown as MobilePost[];

  console.log(`[reprocess] ${pending.length} posts pending\n`);

  // As of the switch to apify/instagram-scraper, username is reliable (the
  // custom nau-ig-actor's was not — confirmed it returned the literal string
  // "reel" for /reel/ URLs, sourced from the wrong part of the input URL) and
  // gets written back along with caption.
  const updateMedia = db.prepare(
    `UPDATE posts SET mediaData = ?, instagram_caption = ?, username = COALESCE(?, username), isProcessed = 1, sync_status = 'processed', local_updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
  );
  const markPreserved = db.prepare(
    `UPDATE posts SET isProcessed = 1, sync_status = 'gone_preserved', local_updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
  );

  const deletionCandidates: MobilePost[] = [];
  const failures: { post: MobilePost; error: string }[] = [];
  let foundCount = 0;
  let preservedCount = 0;

  // Cheap integrity net: if two different posts ever end up with the exact
  // same set of storageUrls, something is wrong upstream (this is exactly how
  // the platformId-collision bug surfaced — every post silently got the same
  // 6 R2 objects). Track signatures as we go and fail loudly instead of
  // writing the second occurrence.
  const seenMediaSignatures = new Map<string, number>();

  for (const post of pending) {
    process.stdout.write(`[${post.id}] ${post.instagramUrl} … `);
    try {
      const jobId = await enqueue(post.instagramUrl);
      const result = await pollUntilDone(jobId);

      if (result.outcome === 'found') {
        const urls = result.media.map((m) => m.storageUrl).sort();
        const signature = urls.join('|');
        const priorPostId = seenMediaSignatures.get(signature);
        if (signature && priorPostId !== undefined) {
          throw new Error(
            `identical media set as post id=${priorPostId} (${urls.length} urls) — refusing to write, this is the collision bug, investigate before continuing`,
          );
        }
        seenMediaSignatures.set(signature, post.id);

        const mediaData = result.media.map((m) => ({ type: m.type, url: m.storageUrl, width: m.width, height: m.height }));
        updateMedia.run(JSON.stringify(mediaData), result.caption ?? null, result.username ?? null, post.id);
        foundCount++;
        console.log(`found, ${result.media.length} media, owner=${result.username ?? '?'}`);
      } else {
        // 'not_found' also covers restricted/private — nauthenticity cannot
        // currently tell them apart. Preserved posts are unaffected either
        // way; genuinely-deletable candidates should be opened by hand before
        // apply-deletions runs.
        if (hasCustomTitleOrNote(post)) {
          markPreserved.run(post.id);
          preservedCount++;
          console.log('not found on Instagram — preserved (has title/note)');
        } else {
          deletionCandidates.push(post);
          console.log('not found on Instagram — NO title/note, candidate for deletion');
        }
      }
    } catch (err) {
      failures.push({ post, error: (err as Error).message });
      console.log(`FAILED: ${(err as Error).message}`);
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Found & archived:  ${foundCount}`);
  console.log(`Preserved (gone, but titled/noted): ${preservedCount}`);
  console.log(`Deletion candidates (gone, no title/note — verify before deleting):`);
  for (const c of deletionCandidates) console.log(`  id=${c.id}  ${c.instagramUrl}`);
  console.log(`Failed (left pending, safe to re-run):`);
  for (const f of failures) console.log(`  id=${f.post.id}  ${f.post.instagramUrl}  — ${f.error}`);

  if (deletionCandidates.length > 0) {
    console.log(
      `\nTo delete after review: node --experimental-strip-types reprocess-mobile-captures.ts apply-deletions --ids ${deletionCandidates.map((c) => c.id).join(',')}`,
    );
  }
}

function runApplyDeletions(db: DatabaseSync, ids: number[]) {
  if (ids.length === 0) {
    console.log('No ids passed — nothing to do.');
    return;
  }
  const del = db.prepare(`DELETE FROM posts WHERE id = ?`);
  for (const id of ids) {
    const row = db.prepare(`SELECT instagramUrl FROM posts WHERE id = ?`).get(id) as { instagramUrl: string } | undefined;
    if (!row) {
      console.log(`id=${id} — not found, skipping`);
      continue;
    }
    del.run(id);
    console.log(`id=${id} deleted (${row.instagramUrl})`);
  }
}

async function main() {
  if (!DB_PATH) throw new Error('MOBILE_DB_PATH env var is required — path to the pulled nau_ig.db');
  const db = new DatabaseSync(DB_PATH);

  const [mode, ...rest] = process.argv.slice(2);
  if (mode === 'apply-deletions') {
    const idsFlagIdx = rest.indexOf('--ids');
    const ids = idsFlagIdx >= 0 ? rest[idsFlagIdx + 1].split(',').map(Number) : [];
    runApplyDeletions(db, ids);
  } else {
    await runReprocess(db);
  }

  db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * How to run (from apps/nauthenticity/):
 *
 *   1. cp ~/backups/mobile/<ts>/nau_ig.db /tmp/nau_ig.reprocess.db   (work on a copy)
 *   2. AUTH_SECRET=<same as nauthenticity/.env on the VPS> \
 *      MOBILE_DB_PATH=/tmp/nau_ig.reprocess.db \
 *      node --experimental-strip-types src/scripts/reprocess-mobile-captures.ts
 *   3. Review the deletion-candidates list, open each URL by hand.
 *   4. node --experimental-strip-types src/scripts/reprocess-mobile-captures.ts apply-deletions --ids 12,45
 *   5. adb push /tmp/nau_ig.reprocess.db <device path> — only once the above looks right.
 */

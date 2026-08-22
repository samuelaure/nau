-- Two things the journal needs and did not have: a day boundary that belongs to
-- the person, and a record of when things happened.

-- ── 1. Timezone ───────────────────────────────────────────────────────────────
--
-- Every period boundary was computed in the server's zone. The container runs
-- UTC, so a "day" ran 00:00–23:59 UTC — 02:00 to 01:59 in Madrid. Anything
-- captured between midnight and two in the morning was filed under the previous
-- day.
--
-- Workspace.timezone already existed and was never read; it is what the
-- workspace's own artefacts (summaries, crons) use. User.timezone is the
-- person's, which follows them across workspaces and is what any per-person
-- delivery should use. For a personal workspace the two are the same value,
-- which is why the workspace seeds from its owner below.
ALTER TABLE "User" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC';

-- The one user we have evidence for: every commit authored by this account
-- carries a +02:00 offset, which is Europe/Madrid in summer. The others stay at
-- UTC, which is exactly the behaviour they have today — this migration changes
-- nothing for them rather than guessing where they live.
UPDATE "User" SET "timezone" = 'Europe/Madrid' WHERE email = 'samuelaure@gmail.com';

-- Seed each workspace from its owner, but only where the workspace is still on
-- the default. A workspace someone deliberately set is left alone.
UPDATE "Workspace" w
SET "timezone" = u."timezone"
FROM "WorkspaceMember" m
JOIN "User" u ON u.id = m."userId"
WHERE m."workspaceId" = w.id
  AND m.role = 'OWNER'
  AND w."timezone" = 'UTC'
  AND u."timezone" <> 'UTC';

-- ── 2. Activity events ────────────────────────────────────────────────────────
--
-- Event existed with no rows and no writer. It gains the two columns needed to
-- query a day's activity without joining Block, plus the index that query needs.
--
-- Existing rows: none, so the columns are added nullable with nothing to
-- backfill. Everything written from now on carries both.
ALTER TABLE "Event" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Event" ADD COLUMN "userId" TEXT;

CREATE INDEX "Event_workspaceId_createdAt_idx" ON "Event"("workspaceId", "createdAt");
CREATE INDEX "Event_blockId_idx" ON "Event"("blockId");

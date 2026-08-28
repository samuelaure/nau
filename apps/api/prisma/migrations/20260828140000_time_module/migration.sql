-- The Time module: one place that owns periods, scales and recurrence.
--
-- Renames carry meaning here, they are not tidying:
--   Calendar          → TimeSystemConfig   ("calendar" meant both a system of
--                                           division and an agenda you look at,
--                                           and excluded by its own name the
--                                           systems that are not calendars)
--   Schedule          → Planning           ("schedule" already means cron in
--                                           this codebase, via @nestjs/schedule)
--   ScheduleException → OccurrenceOverride (a decision, not an error)
--   Period            → NamedPeriod        (a row is the exception, not the norm)
--   schedule.rrule    → planning.recurrence (the field was named after
--                                            Gregorian's library, which no other
--                                            system can implement)
--
-- Verified against production before writing (2026-08-28): 27 Schedule rows,
-- 1 Calendar row, 0 Period rows, 0 TimeEntry rows, 0 ScheduleException rows,
-- 3 occurrence.completed events. Every schedule is a single day and none has an
-- rrule, which is what makes the backfill below exact rather than approximate.

-- ── 1. Planning ─────────────────────────────────────────────────────────────
--
-- The identity of a plan becomes {system, scale, anchor}: which time system it
-- was placed in, which of that system's scales, and an instant inside the
-- period. That triple NAMES the period instead of measuring it, which is what
-- lets it survive a timezone change with nothing to migrate.
--
-- from/to stay as a derived cache so a query can filter on an index rather than
-- resolving every system in memory. They are rebuildable from the triple and
-- must never be edited on their own.

ALTER TABLE "Schedule" RENAME TO "Planning";
ALTER TABLE "Planning" RENAME CONSTRAINT "Schedule_pkey" TO "Planning_pkey";
ALTER TABLE "Planning" RENAME CONSTRAINT "Schedule_blockId_fkey" TO "Planning_blockId_fkey";
ALTER INDEX "Schedule_blockId_key" RENAME TO "Planning_blockId_key";

ALTER TABLE "Planning" RENAME COLUMN "rrule" TO "recurrence";
ALTER TABLE "Planning" RENAME COLUMN "timezone" TO "recurrenceTimezone";

ALTER TABLE "Planning" ADD COLUMN "system" TEXT NOT NULL DEFAULT 'gregorian';
ALTER TABLE "Planning" ADD COLUMN "scale"  TEXT NOT NULL DEFAULT 'day';
ALTER TABLE "Planning" ADD COLUMN "anchor" TIMESTAMP(3);
ALTER TABLE "Planning" ADD COLUMN "from"   TIMESTAMP(3);
ALTER TABLE "Planning" ADD COLUMN "to"     TIMESTAMP(3);

-- ── 2. Repair the day-shift defect before deriving anything from it ─────────
--
-- Two conventions are present in the existing rows, and one of them is wrong.
--
-- The 19 rows written by the application store local midnight correctly:
-- 2026-08-22T22:00 in a `timestamp without time zone` column is midnight in
-- Madrid, which is what "the 23rd" means for that workspace.
--
-- The 8 rows whose ids begin `sch_mig_` came from the 20260824090000
-- backfill, which wrote 00:00:00 — UTC midnight, not local. Read back in
-- Madrid those land at 22:00 the PREVIOUS day, so every one of them is filed
-- under the wrong date. Verified: `sch_mig_…` rows dated 2026-06-22 read as
-- 2026-06-21 in Europe/Madrid.
--
-- Carrying that forward would bake a known-wrong day into the new identity, so
-- it is corrected here rather than inherited. Only rows that are exactly at UTC
-- midnight AND came from that backfill are touched; a genuine midnight-UTC
-- workspace is unaffected because the correction is computed from its own zone.
-- On the conversion: the column is `timestamp without time zone` holding UTC.
-- `date_trunc(...) AT TIME ZONE <zone>` reads the naive value AS wall-clock time
-- in that zone and yields the UTC instant for it, which is exactly the
-- correction wanted. The result must be cast back to a naive timestamp — the
-- expression is `timestamptz`, and assigning that to a `timestamp` column
-- re-converts it through the session's zone and lands two hours out.
UPDATE "Planning" p
SET "startDate" = ((date_trunc('day', p."startDate") AT TIME ZONE COALESCE(w."timezone", 'UTC'))
                     AT TIME ZONE 'UTC'),
    "endDate"   = CASE WHEN p."endDate" IS NULL THEN NULL
                  ELSE ((date_trunc('day', p."startDate") AT TIME ZONE COALESCE(w."timezone", 'UTC'))
                          AT TIME ZONE 'UTC')
                       + interval '1 day' - interval '1 millisecond'
                  END
FROM "Block" b
LEFT JOIN "Workspace" w ON w.id = b."workspaceId"
WHERE b.id = p."blockId"
  AND p.id LIKE 'sch_mig_%'
  AND p."startDate" = date_trunc('day', p."startDate");

-- ── 3. Backfill the identity ────────────────────────────────────────────────
--
-- The anchor is the start of the plan: any instant inside the period resolves
-- to the same period, and the start is guaranteed to be inside it.
UPDATE "Planning" SET "anchor" = "startDate" WHERE "anchor" IS NULL;

-- Scale is derived from the span, once, for historical rows whose original
-- intent was never recorded. This is the `granularityOf` approximation the new
-- design deliberately does NOT use at query time: applying it forever would
-- make a 9-day task jump to "month" over one day's difference. Applied once to
-- data whose intent is already lost, it is the honest reconstruction available.
--
-- For this database it is exact rather than approximate: all 27 rows span a
-- single day.
UPDATE "Planning"
SET "scale" = CASE
  WHEN "endDate" IS NULL THEN 'day'
  WHEN EXTRACT(EPOCH FROM ("endDate" - "startDate")) <  86400 * 1.5  THEN 'day'
  WHEN EXTRACT(EPOCH FROM ("endDate" - "startDate")) <= 86400 * 8    THEN 'week'
  WHEN EXTRACT(EPOCH FROM ("endDate" - "startDate")) <= 86400 * 32   THEN 'month'
  WHEN EXTRACT(EPOCH FROM ("endDate" - "startDate")) <= 86400 * 95   THEN 'quarter'
  ELSE 'year'
END;

-- from/to become half-open. The old endDate was inclusive (23:59:59.999), so
-- the exclusive end is one millisecond later. Both describe the same stretch;
-- half-open makes adjacency exact, so an instant at midnight belongs to one
-- period rather than to two.
UPDATE "Planning"
SET "from" = "startDate",
    "to"   = CASE
      WHEN "endDate" IS NULL THEN "startDate" + interval '1 day'
      ELSE "endDate" + interval '1 millisecond'
    END
WHERE "from" IS NULL;

-- Every row now has an identity, so the columns become required.
ALTER TABLE "Planning" ALTER COLUMN "anchor" SET NOT NULL;
ALTER TABLE "Planning" ALTER COLUMN "from"   SET NOT NULL;
ALTER TABLE "Planning" ALTER COLUMN "to"     SET NOT NULL;

-- startDate/endDate are now derived twice over — the identity is the anchor and
-- the resolved span is from/to. Keeping them would be a second convention for
-- one fact, and consumers would have to know which to trust.
ALTER TABLE "Planning" DROP COLUMN "startDate";
ALTER TABLE "Planning" DROP COLUMN "endDate";

-- Completion of a non-recurring plan lives in the event log with every other
-- completion. A column here was the second place the same fact could be stored.
-- Safe to drop: no row has ever set it (verified, 0 of 27).
ALTER TABLE "Planning" DROP COLUMN "completedAt";

DROP INDEX IF EXISTS "Schedule_startDate_idx";
CREATE INDEX "Planning_from_to_idx" ON "Planning"("from", "to");
CREATE INDEX "Planning_system_scale_idx" ON "Planning"("system", "scale");

-- ── 4. OccurrenceOverride ───────────────────────────────────────────────────
ALTER TYPE "ScheduleExceptionKind" RENAME TO "OverrideKind";

ALTER TABLE "ScheduleException" RENAME TO "OccurrenceOverride";
ALTER TABLE "OccurrenceOverride" RENAME CONSTRAINT "ScheduleException_pkey" TO "OccurrenceOverride_pkey";
ALTER TABLE "OccurrenceOverride" RENAME COLUMN "scheduleId" TO "planningId";
ALTER TABLE "OccurrenceOverride" RENAME CONSTRAINT "ScheduleException_scheduleId_fkey" TO "OccurrenceOverride_planningId_fkey";
ALTER INDEX "ScheduleException_scheduleId_occurrenceAt_key" RENAME TO "OccurrenceOverride_planningId_occurrenceAt_key";
ALTER INDEX "ScheduleException_scheduleId_idx" RENAME TO "OccurrenceOverride_planningId_idx";

-- ── 5. TimeSystemConfig ─────────────────────────────────────────────────────
--
-- Replaces Calendar. The shared built-in row — one row with a null workspaceId
-- that every workspace borrowed until it changed something — is not carried
-- over. Defaults belong in the system's code, and a shared mutable row is a
-- write away from changing the week for everybody at once.
CREATE TABLE "TimeSystemConfig" (
    "id"          TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "system"      TEXT NOT NULL,
    "enabled"     BOOLEAN NOT NULL DEFAULT true,
    "config"      JSONB NOT NULL DEFAULT '{}',
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TimeSystemConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TimeSystemConfig_workspaceId_system_key"
    ON "TimeSystemConfig"("workspaceId", "system");

-- Every existing workspace keeps the week it already had.
--
-- The default for NEW workspaces becomes Sunday, which is a change of meaning.
-- It is safe precisely because migration 20260824180000_calendar_config wrote
-- firstDayOfWeek explicitly into the shared row: the value is recorded rather
-- than inherited, so writing it per workspace here preserves exactly what each
-- one was already getting, and nobody's weeks move underneath them.
INSERT INTO "TimeSystemConfig" ("id", "workspaceId", "system", "enabled", "config", "updatedAt")
SELECT
    'tsc_' || w.id || '_gregorian',
    w.id,
    'gregorian',
    true,
    COALESCE(
        (SELECT c."config" FROM "Calendar" c
          WHERE c."workspaceId" = w.id AND c."kind" = 'GREGORIAN' LIMIT 1),
        (SELECT c."config" FROM "Calendar" c
          WHERE c."workspaceId" IS NULL AND c."kind" = 'GREGORIAN' LIMIT 1),
        '{"firstDayOfWeek": 1}'::jsonb
    ),
    NOW()
FROM "Workspace" w;

-- ── 6. WorkspaceTimezone ────────────────────────────────────────────────────
--
-- Where a workspace has lived, and since when. Without this, changing the
-- current zone silently reinterprets every period already recorded.
CREATE TABLE "WorkspaceTimezone" (
    "id"          TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "timezone"    TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkspaceTimezone_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WorkspaceTimezone_workspaceId_effectiveAt_idx"
    ON "WorkspaceTimezone"("workspaceId", "effectiveAt");
ALTER TABLE "WorkspaceTimezone" ADD CONSTRAINT "WorkspaceTimezone_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Each workspace's current zone, effective from its creation. Backdating to
-- creation rather than to now is what makes every existing period resolve
-- exactly as it did before this migration: there is no instant in the past
-- without a zone in force.
INSERT INTO "WorkspaceTimezone" ("id", "workspaceId", "timezone", "effectiveAt")
SELECT 'wtz_' || w.id || '_initial', w.id, COALESCE(w."timezone", 'UTC'), w."createdAt"
FROM "Workspace" w;

-- ── 7. NamedPeriod ──────────────────────────────────────────────────────────
--
-- Replaces Period. The idea was right — materialise only what carries something
-- of its own — but the execution had no identity: startsAt/endsAt alone cannot
-- survive a timezone change, cannot distinguish a naŭ from a week that happens
-- to coincide, and fails to match when two computations differ by a millisecond.
--
-- Dropped rather than migrated: verified 0 rows in production.
DROP TABLE IF EXISTS "Period";
DROP TABLE IF EXISTS "Calendar";
DROP TYPE IF EXISTS "CalendarKind";

CREATE TABLE "NamedPeriod" (
    "id"          TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "system"      TEXT NOT NULL,
    "scale"       TEXT NOT NULL,
    "anchor"      TIMESTAMP(3) NOT NULL,
    "title"       TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NamedPeriod_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NamedPeriod_workspaceId_system_scale_anchor_key"
    ON "NamedPeriod"("workspaceId", "system", "scale", "anchor");
CREATE INDEX "NamedPeriod_workspaceId_anchor_idx" ON "NamedPeriod"("workspaceId", "anchor");

-- ── 8. TimeEntry ────────────────────────────────────────────────────────────
--
-- Dropped. Zero consumers anywhere in the API, the app or the packages, and
-- zero rows in production — it was schema surface with no behaviour, which a
-- reader cannot tell is inert.
--
-- It also does not belong to Time even if time tracking returns: Time answers
-- what periods exist and when things occur, while recording work that actually
-- happened is Actions' domain. See issue #51; recreate it there if wanted.
DROP TABLE IF EXISTS "TimeEntry";

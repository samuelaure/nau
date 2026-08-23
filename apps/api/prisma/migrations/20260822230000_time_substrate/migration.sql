-- The shared time substrate: plan, fact, and the calendars that group them.
--
-- Journal, actions, habits and finances all need to place things in time and
-- read them back by period. Building that once, in the substrate, is what stops
-- it being rebuilt four times — it has already been designed three times in this
-- codebase (two abandoned schemas in tmp/schema_ref, plus the current Schedule)
-- and each attempt lost something the previous one had.
--
-- The dividing line is between what is planned and what happened. A Schedule is
-- a plan and gets edited; a TimeEntry is a fact and does not. Mixing them is
-- what makes it impossible to tell what was intended from what occurred.

-- ── Schedule gains a timezone and exceptions ─────────────────────────────────
--
-- A recurrence rule without a zone is meaningless: "every weekday at 08:00"
-- resolves to different instants either side of a daylight-saving change, so
-- without this the rule drifts by an hour twice a year. Null means "use the
-- workspace's zone", which is the behaviour every existing row already has.
ALTER TABLE "Schedule" ADD COLUMN "timezone" TEXT;

CREATE INDEX "Schedule_startDate_idx" ON "Schedule"("startDate");

-- Occurrences of a recurring schedule are DERIVED from the rule, never stored.
-- A daily habit would otherwise write 365 rows a year that say nothing the rule
-- does not already say. Only a departure from the rule earns a row, which is the
-- same shape RFC 5545 uses (EXDATE for skipped, RECURRENCE-ID for moved).
CREATE TYPE "ScheduleExceptionKind" AS ENUM ('SKIPPED', 'MOVED');

CREATE TABLE "ScheduleException" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "occurrenceAt" TIMESTAMP(3) NOT NULL,
    "kind" "ScheduleExceptionKind" NOT NULL,
    "movedTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScheduleException_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScheduleException_scheduleId_occurrenceAt_key"
    ON "ScheduleException"("scheduleId", "occurrenceAt");
CREATE INDEX "ScheduleException_scheduleId_idx" ON "ScheduleException"("scheduleId");

ALTER TABLE "ScheduleException" ADD CONSTRAINT "ScheduleException_scheduleId_fkey"
    FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Time actually spent ──────────────────────────────────────────────────────
--
-- One block accumulates many sessions, which is how a task worked across three
-- sittings stays one task. endedAt is null while a session is running.
CREATE TABLE "TimeEntry" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "userId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TimeEntry_blockId_idx" ON "TimeEntry"("blockId");
CREATE INDEX "TimeEntry_workspaceId_startedAt_idx" ON "TimeEntry"("workspaceId", "startedAt");

ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_blockId_fkey"
    FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Calendars and named periods ──────────────────────────────────────────────
--
-- Gregorian is one way of dividing time, not the ground truth. It arrives here
-- as a row rather than as an assumption in the code, so that adding the naŭ
-- calendar (9-day weeks, 27-day months), astrological transits, or personal
-- epochs is a row and a bounds function rather than a rewrite.
--
-- Ordinary periods are derived: "August 2026" is computed from a range and needs
-- no storage. Period holds only what cannot be computed — an epoch that follows
-- where someone was living, or a stretch someone chose to name. "The year of the
-- dragon" recalls a life in a way "2024" does not, and that name is the whole
-- reason the table exists.
CREATE TYPE "CalendarKind" AS ENUM ('GREGORIAN', 'NAU', 'ASTROLOGICAL', 'PERSONAL');

CREATE TABLE "Calendar" (
    "id" TEXT NOT NULL,
    "kind" "CalendarKind" NOT NULL,
    "name" TEXT NOT NULL,
    "workspaceId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Calendar_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Calendar_workspaceId_kind_name_key"
    ON "Calendar"("workspaceId", "kind", "name");

CREATE TABLE "Period" (
    "id" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "name" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Period_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Period_workspaceId_startsAt_idx" ON "Period"("workspaceId", "startsAt");
CREATE INDEX "Period_calendarId_idx" ON "Period"("calendarId");

ALTER TABLE "Period" ADD CONSTRAINT "Period_calendarId_fkey"
    FOREIGN KEY ("calendarId") REFERENCES "Calendar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The one calendar that exists today, made explicit. Everything the journal
-- currently computes is the Gregorian interpretation of a date range; until now
-- that was an assumption with no name. workspaceId is null because it is
-- built in and available to every workspace.
INSERT INTO "Calendar" ("id", "kind", "name", "workspaceId", "isDefault", "createdAt", "updatedAt")
VALUES ('cal_gregorian', 'GREGORIAN', 'Gregoriano', NULL, true, NOW(), NOW());

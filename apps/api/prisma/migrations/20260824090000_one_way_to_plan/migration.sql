-- There were two ways to plan an action, and they could not see each other.
--
-- The home view wrote `properties.date` as a string and read `properties.completed`
-- as a boolean. The agenda wrote a `Schedule` row and recorded completion in the
-- event log. Neither read what the other produced: every action in the database
-- had a date and none had a schedule, so the agenda showed nothing the user had,
-- and anything created in the agenda never appeared at home.
--
-- One way from here. `Schedule` says when something is due; `properties.date`
-- goes back to meaning only what it means for a note or an experience — when the
-- thing belongs, not when it is owed.

-- ── 1. Every actionable block gets the schedule it should always have had ────
--
-- The day is resolved in the workspace's own zone, not the server's. A block
-- whose date reads '2026-08-23' means that calendar day where the person lives,
-- and reading it in UTC would file two hours of it under the day before.
--
-- Both stored shapes are handled: a bare 'YYYY-MM-DD' from the home view and a
-- full ISO instant from Zazŭ's triage. Casting to timestamptz accepts either,
-- and truncating in the local zone collapses them to the same answer.
INSERT INTO "Schedule" ("id", "blockId", "startDate", "endDate", "recurrenceMode", "createdAt", "updatedAt")
SELECT
    'sch_mig_' || b.id,
    b.id,
    date_trunc('day', (b.properties->>'date')::timestamptz AT TIME ZONE COALESCE(w.timezone, 'UTC')),
    date_trunc('day', (b.properties->>'date')::timestamptz AT TIME ZONE COALESCE(w.timezone, 'UTC'))
        + interval '1 day' - interval '1 millisecond',
    'FIXED',
    NOW(),
    NOW()
FROM "Block" b
LEFT JOIN "Workspace" w ON w.id = b."workspaceId"
LEFT JOIN "Schedule" s ON s."blockId" = b.id
WHERE b."deletedAt" IS NULL
  AND b.type IN ('action', 'habit', 'appointment')
  AND b.properties ? 'date'
  AND b.properties->>'date' <> ''
  AND s.id IS NULL;

-- ── 2. One field for whether something is done ──────────────────────────────
--
-- `properties.completed` was a second field for the same fact, and it is the one
-- that cannot express a habit: a habit is never simply done, it is performed once
-- per occurrence. The event log holds that, and `properties.status` stays as the
-- derived summary for blocks that have exactly one occurrence.
--
-- Anything currently flagged completed is folded into status before the field is
-- dropped, so no completion is lost even though nothing writes it today.
UPDATE "Block"
SET properties = (properties - 'completed')
     || jsonb_build_object('status', CASE WHEN properties->>'completed' = 'true' THEN 'done' ELSE COALESCE(properties->>'status', 'todo') END)
WHERE properties ? 'completed';

-- ── 3. Experiences and journal entries were always the same thing ───────────
--
-- Two names for one concept, from two attempts at it. `journal_entry` is the one
-- that is actively written — by Zazŭ, by the web capture, by the voice pipeline —
-- and the one with 76 rows behind it. `experience` has none, so this is a rename
-- that closes a door rather than a data move.
UPDATE "Block"
SET type = 'journal_entry'
WHERE type = 'experience';

-- ── 4. The free-text schedule field that nothing ever read ──────────────────
--
-- BlockEditorModal stored `properties.schedule` as a string. No reader existed;
-- the agenda has always read the Schedule table. Removing it stops the two from
-- being confused for each other.
UPDATE "Block"
SET properties = properties - 'schedule'
WHERE properties ? 'schedule';

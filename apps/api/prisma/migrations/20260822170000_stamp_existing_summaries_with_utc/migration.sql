-- Period boundaries used to be computed in the server's zone, which is UTC.
-- From now on they are computed in the workspace's zone, and every new summary
-- records which zone that was in `properties.timezone`.
--
-- That leaves the 34 existing summaries expressing the old convention with no
-- way to tell: a daily whose periodStart is 2026-05-13T00:00:00Z covers a UTC
-- day, while a daily generated tomorrow for a Madrid workspace will start at
-- 22:00 the previous evening. Same field, same type, two different meanings, and
-- nothing on the row to distinguish them.
--
-- The bounds themselves are NOT rewritten. They correctly describe the window
-- the summary's content was actually built from; moving them would make the
-- metadata lie about the text. What is added is the missing fact — which zone
-- each row was computed in — so both conventions stay readable.

UPDATE "Block"
SET properties = properties || jsonb_build_object('timezone', 'UTC')
WHERE type = 'journal_summary'
  AND "deletedAt" IS NULL
  AND NOT (properties ? 'timezone');

-- Soft-deleted summaries are stamped too. They are recoverable by design, and a
-- row restored later should not come back carrying an ambiguous boundary.
UPDATE "Block"
SET properties = properties || jsonb_build_object('timezone', 'UTC')
WHERE type = 'journal_summary'
  AND "deletedAt" IS NOT NULL
  AND NOT (properties ? 'timezone');

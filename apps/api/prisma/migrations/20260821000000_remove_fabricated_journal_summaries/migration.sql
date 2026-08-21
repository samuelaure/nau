-- The nightly journal cron ran unconditionally, so on any day with no activity
-- it still called the LLM and asked it to summarise a period containing
-- nothing. The model obliged: 95 summaries describe events that never happened,
-- in generic reflective prose, written into a personal journal as though they
-- were a record of the user's life.
--
-- An empty journal is honest. A journal filled with plausible fiction is not,
-- and it is worse the longer it sits there looking like memory.
--
-- Soft delete, not removal: the rows stay recoverable, and every consumer
-- already filters on deletedAt.
--
-- The generator was fixed separately — it now returns early when a period has
-- no journal entries, actions or content ideas — so this is a one-time cleanup
-- of what it produced before that guard existed.

UPDATE "Block" s
SET "deletedAt" = NOW()
WHERE s.type = 'journal_summary'
  AND s."deletedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "Block" b
    WHERE b."deletedAt" IS NULL
      AND b.type IN ('journal_entry', 'action', 'content_idea')
      AND b."createdAt" BETWEEN
            (s.properties->>'periodStart')::timestamp
        AND (s.properties->>'periodEnd')::timestamp
  );

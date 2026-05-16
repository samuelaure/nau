-- Backfill: posts that belong to a finished run should be 'ready', not 'pending'
UPDATE "Post"
SET status = 'ready'
WHERE status = 'pending'
  AND "runId" IS NOT NULL
  AND "runId" IN (
    SELECT id FROM "ScrapingRun" WHERE phase = 'finished'
  );

-- Posts with no run (added individually / pre-pipeline) that have a postSynthesis are also done
UPDATE "Post"
SET status = 'ready'
WHERE status = 'pending'
  AND "runId" IS NULL
  AND "postSynthesis" IS NOT NULL;

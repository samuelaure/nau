-- Journal summaries created by the nightly cron were written without a
-- workspaceId, because JournalService.generateSummary queries blocks globally.
-- Once /blocks is scoped by workspace membership these rows become unreachable,
-- so they are re-attached to the workspace of the content they summarize by
-- walking the relation graph:
--
--   summarized_by     : journal_entry (from) -> summary (to)
--   parent_summary_of : parent summary (from) -> child summary (to)
--
-- Nested periods (week -> month -> quarter -> year) resolve bottom-up, so the
-- two updates are repeated until they reach a fixed point.

DO $$
DECLARE
  touched INTEGER;
BEGIN
  FOR _ IN 1..10 LOOP
    touched := 0;

    -- A summary inherits the workspace of the entries it summarizes.
    WITH updated AS (
      UPDATE "Block" s
      SET "workspaceId" = e."workspaceId"
      FROM "Relation" r
      JOIN "Block" e ON e.id = r."fromBlockId"
      WHERE r."toBlockId" = s.id
        AND r.type = 'summarized_by'
        AND s.type = 'journal_summary'
        AND s."workspaceId" IS NULL
        AND e."workspaceId" IS NOT NULL
      RETURNING s.id
    )
    SELECT touched + COUNT(*) INTO touched FROM updated;

    -- A parent summary inherits the workspace of its child summaries.
    WITH updated AS (
      UPDATE "Block" p
      SET "workspaceId" = c."workspaceId"
      FROM "Relation" r
      JOIN "Block" c ON c.id = r."toBlockId"
      WHERE r."fromBlockId" = p.id
        AND r.type = 'parent_summary_of'
        AND p.type = 'journal_summary'
        AND p."workspaceId" IS NULL
        AND c."workspaceId" IS NOT NULL
      RETURNING p.id
    )
    SELECT touched + COUNT(*) INTO touched FROM updated;

    EXIT WHEN touched = 0;
  END LOOP;
END $$;

-- Summaries for periods that produced no linked entries have no graph to walk.
-- They are only safe to place when the journal corpus lives in exactly one
-- workspace; otherwise they are left orphaned for manual triage rather than
-- guessed into the wrong tenant.
UPDATE "Block" s
SET "workspaceId" = (
  SELECT DISTINCT "workspaceId"
  FROM "Block"
  WHERE type = 'journal_entry' AND "workspaceId" IS NOT NULL
)
WHERE s.type = 'journal_summary'
  AND s."workspaceId" IS NULL
  AND (
    SELECT COUNT(DISTINCT "workspaceId")
    FROM "Block"
    WHERE type = 'journal_entry' AND "workspaceId" IS NOT NULL
  ) = 1;

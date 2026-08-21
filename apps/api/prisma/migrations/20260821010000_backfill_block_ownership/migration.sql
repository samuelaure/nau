-- Blocks carry a workspaceId but many carry no userId, so there is no record of
-- who wrote them. Journal entries are the clearest case: all 76 came from Zazu,
-- which sends the user id, but the journal-only path never passed it on.
--
-- Ownership can be inferred safely only where a workspace has exactly one
-- member — then there is no ambiguity about who authored anything in it.
-- Multi-member workspaces are left alone: guessing an author is worse than
-- leaving the field empty, because a wrong attribution looks like a fact.
--
-- The code path is fixed separately so new entries arrive with an owner.

UPDATE "Block" b
SET "userId" = m."userId"
FROM (
  SELECT "workspaceId", MIN("userId") AS "userId"
  FROM "WorkspaceMember"
  GROUP BY "workspaceId"
  HAVING COUNT(*) = 1
) m
WHERE b."workspaceId" = m."workspaceId"
  AND b."userId" IS NULL;

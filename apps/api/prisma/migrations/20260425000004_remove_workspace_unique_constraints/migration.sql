-- Remove unique constraint from workspace slug
-- Workspace name and slug can now be duplicated; only ID is unique
ALTER TABLE "Workspace" DROP CONSTRAINT IF EXISTS "Workspace_slug_key";
DROP INDEX IF EXISTS "Workspace_slug_key";

-- Add slug and timezone columns to Workspace
ALTER TABLE "Workspace" ADD COLUMN "slug" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC';

-- Back-fill slug from name for any existing rows
UPDATE "Workspace" SET "slug" = lower(regexp_replace(name, '[^a-z0-9]+', '-', 'gi'));

-- Now enforce uniqueness and NOT NULL
ALTER TABLE "Workspace" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

-- Rename WorkspaceRole enum values from lowercase to uppercase
ALTER TYPE "WorkspaceRole" RENAME VALUE 'owner' TO 'OWNER';
ALTER TYPE "WorkspaceRole" RENAME VALUE 'admin' TO 'ADMIN';
ALTER TYPE "WorkspaceRole" RENAME VALUE 'member' TO 'MEMBER';

-- Update the default on WorkspaceMember.role to match new enum value
ALTER TABLE "WorkspaceMember" ALTER COLUMN "role" SET DEFAULT 'OWNER';

-- AlterTable
ALTER TABLE "WorkspaceMember" ADD COLUMN IF NOT EXISTS "notificationSettings" JSONB NOT NULL DEFAULT '{}';

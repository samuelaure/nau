-- Remove deprecated Brand fields that were in schema.prisma but never existed in production DB.
-- voicePrompt and commentStrategy were deprecated and dropped; removing from schema to fix
-- Prisma client mismatch that caused runtime errors on Brand queries.
ALTER TABLE "Brand" DROP COLUMN IF EXISTS "voicePrompt";
ALTER TABLE "Brand" DROP COLUMN IF EXISTS "commentStrategy";

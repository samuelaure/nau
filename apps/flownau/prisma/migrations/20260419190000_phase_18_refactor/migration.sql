-- Phase 18: decouple pipeline gates, introduce ContentCreationPrinciples + AccountTemplateConfig,
-- wire provenance through ideation → development → composition, delete PostingSchedule.
-- No data migration — no production data exists yet.

-- ---------------------------------------------------------------------------
-- DROP legacy objects
-- ---------------------------------------------------------------------------

-- Drop PostingSchedule entirely (replaced by ContentPlanner)
DROP TABLE IF EXISTS "PostingSchedule";

-- Remove Phase 17's transitional Template.autoApprovePost (moves to AccountTemplateConfig)
ALTER TABLE "Template" DROP COLUMN IF EXISTS "autoApprovePost";

-- Make Template.accountId required (templates are always account-scoped from Phase 18)
-- No backfill needed — empty DB. Drop the FK if present, re-add as NOT NULL, with ON DELETE CASCADE.
ALTER TABLE "Template" ALTER COLUMN "accountId" SET NOT NULL;

-- ---------------------------------------------------------------------------
-- Template.scope + contentSchema
-- ---------------------------------------------------------------------------

ALTER TABLE "Template" ADD COLUMN IF NOT EXISTS "scope" TEXT NOT NULL DEFAULT 'account';
ALTER TABLE "Template" ADD COLUMN IF NOT EXISTS "contentSchema" JSONB;

-- ---------------------------------------------------------------------------
-- ContentIdea provenance columns
-- ---------------------------------------------------------------------------

ALTER TABLE "ContentIdea" ADD COLUMN IF NOT EXISTS "brandPersonaId" TEXT;
ALTER TABLE "ContentIdea" ADD COLUMN IF NOT EXISTS "ideasFrameworkId" TEXT;
ALTER TABLE "ContentIdea" ADD COLUMN IF NOT EXISTS "contentPrinciplesId" TEXT;

-- ---------------------------------------------------------------------------
-- Composition provenance + user-managed media columns
-- ---------------------------------------------------------------------------

ALTER TABLE "Composition" ADD COLUMN IF NOT EXISTS "brandPersonaId" TEXT;
ALTER TABLE "Composition" ADD COLUMN IF NOT EXISTS "ideasFrameworkId" TEXT;
ALTER TABLE "Composition" ADD COLUMN IF NOT EXISTS "contentPrinciplesId" TEXT;
ALTER TABLE "Composition" ADD COLUMN IF NOT EXISTS "userUploadedMediaUrl" TEXT;
ALTER TABLE "Composition" ADD COLUMN IF NOT EXISTS "userPostedManually" BOOLEAN NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- ContentPlanner strategist fields
-- ---------------------------------------------------------------------------

ALTER TABLE "ContentPlanner" ADD COLUMN IF NOT EXISTS "strategistPrompt" TEXT;
ALTER TABLE "ContentPlanner" ADD COLUMN IF NOT EXISTS "daysToPlan" INTEGER NOT NULL DEFAULT 7;

-- ---------------------------------------------------------------------------
-- New table: ContentCreationPrinciples
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "ContentCreationPrinciples" (
  "id"           TEXT PRIMARY KEY,
  "accountId"    TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "systemPrompt" TEXT NOT NULL,
  "isDefault"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContentCreationPrinciples_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "ContentCreationPrinciples_accountId_idx"
  ON "ContentCreationPrinciples"("accountId");

-- ---------------------------------------------------------------------------
-- New table: AccountTemplateConfig
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "AccountTemplateConfig" (
  "id"              TEXT PRIMARY KEY,
  "accountId"       TEXT NOT NULL,
  "templateId"      TEXT NOT NULL,
  "autoApprovePost" BOOLEAN NOT NULL DEFAULT false,
  "enabled"         BOOLEAN NOT NULL DEFAULT true,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccountTemplateConfig_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE,
  CONSTRAINT "AccountTemplateConfig_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE,
  CONSTRAINT "AccountTemplateConfig_accountId_templateId_key"
    UNIQUE ("accountId", "templateId")
);
CREATE INDEX IF NOT EXISTS "AccountTemplateConfig_accountId_idx"
  ON "AccountTemplateConfig"("accountId");
CREATE INDEX IF NOT EXISTS "AccountTemplateConfig_templateId_idx"
  ON "AccountTemplateConfig"("templateId");

-- ---------------------------------------------------------------------------
-- Foreign keys for provenance (added after the new tables exist)
-- ---------------------------------------------------------------------------

ALTER TABLE "ContentIdea"
  ADD CONSTRAINT "ContentIdea_brandPersonaId_fkey"
    FOREIGN KEY ("brandPersonaId") REFERENCES "BrandPersona"("id") ON DELETE SET NULL;
ALTER TABLE "ContentIdea"
  ADD CONSTRAINT "ContentIdea_ideasFrameworkId_fkey"
    FOREIGN KEY ("ideasFrameworkId") REFERENCES "IdeasFramework"("id") ON DELETE SET NULL;
ALTER TABLE "ContentIdea"
  ADD CONSTRAINT "ContentIdea_contentPrinciplesId_fkey"
    FOREIGN KEY ("contentPrinciplesId") REFERENCES "ContentCreationPrinciples"("id") ON DELETE SET NULL;

ALTER TABLE "Composition"
  ADD CONSTRAINT "Composition_brandPersonaId_fkey"
    FOREIGN KEY ("brandPersonaId") REFERENCES "BrandPersona"("id") ON DELETE SET NULL;
ALTER TABLE "Composition"
  ADD CONSTRAINT "Composition_ideasFrameworkId_fkey"
    FOREIGN KEY ("ideasFrameworkId") REFERENCES "IdeasFramework"("id") ON DELETE SET NULL;
ALTER TABLE "Composition"
  ADD CONSTRAINT "Composition_contentPrinciplesId_fkey"
    FOREIGN KEY ("contentPrinciplesId") REFERENCES "ContentCreationPrinciples"("id") ON DELETE SET NULL;

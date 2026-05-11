-- Category Restructure
-- Replaces SocialProfileMonitor + InspoItem with a single CategoryMembership table.
-- OWN ownership remains on SocialProfile.ownerId (untouched).
--
-- Mapping (data-preserving):
--   SocialProfileMonitor.monitoringType='content'      → CategoryMembership.category='COMMENT'  (profile-level)
--   SocialProfileMonitor.monitoringType='inspiration'  → CategoryMembership.category='INSPO'    (profile-level)
--   SocialProfileMonitor.monitoringType='benchmark'    → CategoryMembership.category='BENCHMARK' (profile-level)
--   InspoItem (postId IS NOT NULL)                     → CategoryMembership.category='INSPO'    (post-level)
--   InspoItem (postId IS NULL, sourceUrl set)          → DROPPED (loose source-only items not modeled in new schema)
-- InspoItem enrichment fields (extractedHook, extractedTheme, adaptedScript, injectedContext, note, status) are intentionally dropped.
-- The redesigned ideation pipeline (Priority 3) will derive these from Post directly.

-- Step 1: Create CategoryMembership table
CREATE TABLE "CategoryMembership" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "socialProfileId" TEXT,
    "postId" TEXT,
    "category" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CategoryMembership_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CategoryMembership_brandId_category_idx" ON "CategoryMembership"("brandId", "category");
CREATE INDEX "CategoryMembership_socialProfileId_idx" ON "CategoryMembership"("socialProfileId");
CREATE INDEX "CategoryMembership_postId_idx" ON "CategoryMembership"("postId");

-- Partial unique indexes: enforce uniqueness for profile-level vs post-level memberships separately.
-- (Postgres treats NULL as distinct in standard unique indexes, so we need partial indexes.)
CREATE UNIQUE INDEX "CategoryMembership_brandId_category_socialProfileId_unique"
  ON "CategoryMembership"("brandId", "category", "socialProfileId")
  WHERE "postId" IS NULL;
CREATE UNIQUE INDEX "CategoryMembership_brandId_category_postId_unique"
  ON "CategoryMembership"("brandId", "category", "postId")
  WHERE "socialProfileId" IS NULL;

-- Step 2: Migrate SocialProfileMonitor → CategoryMembership (profile-level memberships)
INSERT INTO "CategoryMembership" ("id", "brandId", "socialProfileId", "postId", "category", "isActive", "createdAt")
SELECT
    gen_random_uuid()::text,
    "brandId",
    "socialProfileId",
    NULL,
    CASE "monitoringType"
        WHEN 'content' THEN 'COMMENT'
        WHEN 'inspiration' THEN 'INSPO'
        WHEN 'benchmark' THEN 'BENCHMARK'
        ELSE UPPER("monitoringType")
    END,
    "isActive",
    "createdAt"
FROM "SocialProfileMonitor";

-- Step 3: Migrate InspoItem → CategoryMembership (post-level INSPO memberships)
-- Only items with a real Post linkage; loose sourceUrl-only items are not represented in the new model.
INSERT INTO "CategoryMembership" ("id", "brandId", "socialProfileId", "postId", "category", "isActive", "createdAt")
SELECT
    gen_random_uuid()::text,
    "brandId",
    NULL,
    "postId",
    'INSPO',
    true,
    "createdAt"
FROM "InspoItem"
WHERE "postId" IS NOT NULL
ON CONFLICT ("brandId", "category", "socialProfileId", "postId") DO NOTHING;

-- Step 4: Drop old tables
ALTER TABLE "InspoItem" DROP CONSTRAINT "InspoItem_brandId_fkey";
ALTER TABLE "InspoItem" DROP CONSTRAINT "InspoItem_postId_fkey";
ALTER TABLE "SocialProfileMonitor" DROP CONSTRAINT "SocialProfileMonitor_brandId_fkey";
ALTER TABLE "SocialProfileMonitor" DROP CONSTRAINT "SocialProfileMonitor_socialProfileId_fkey";
DROP TABLE "InspoItem";
DROP TABLE "SocialProfileMonitor";

-- Step 5: Add foreign keys to CategoryMembership
ALTER TABLE "CategoryMembership" ADD CONSTRAINT "CategoryMembership_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CategoryMembership" ADD CONSTRAINT "CategoryMembership_socialProfileId_fkey" FOREIGN KEY ("socialProfileId") REFERENCES "SocialProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CategoryMembership" ADD CONSTRAINT "CategoryMembership_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

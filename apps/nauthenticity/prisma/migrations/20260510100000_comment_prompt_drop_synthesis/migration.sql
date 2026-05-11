-- Add commentPrompt to Brand (global custom comment instructions)
ALTER TABLE "Brand" ADD COLUMN "commentPrompt" TEXT;

-- Add commentPrompt to CategoryMembership (per-profile override)
ALTER TABLE "CategoryMembership" ADD COLUMN "commentPrompt" TEXT;

-- Make voicePrompt nullable (column kept for data safety; code no longer reads it)
ALTER TABLE "Brand" ALTER COLUMN "voicePrompt" DROP NOT NULL;

-- Drop BrandSynthesis — all consumers migrated to BrandContext / commentPrompt
DROP TABLE IF EXISTS "BrandSynthesis";

-- Drop voicePrompt — no longer read by any code path; commentPrompt is the replacement
ALTER TABLE "Brand" DROP COLUMN IF EXISTS "voicePrompt";

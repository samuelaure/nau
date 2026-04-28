-- Remove ownedSynthesisPostLimit from Brand (default moved to service code)
ALTER TABLE "Brand" DROP COLUMN IF EXISTS "ownedSynthesisPostLimit";

ALTER TABLE "Asset" ADD COLUMN "optimizationStatus" TEXT NOT NULL DEFAULT 'pending';

-- Backfill: assets with a thumbnail or duration are already optimized.
UPDATE "Asset" SET "optimizationStatus" = 'done'
WHERE "thumbnailUrl" IS NOT NULL
   OR ("duration" IS NOT NULL AND "type" = 'AUD')
   OR "type" = 'IMG';

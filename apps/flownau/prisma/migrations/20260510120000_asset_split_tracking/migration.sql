-- Add split-video tracking columns to Asset.
-- Long videos (>27s) are split into ≤27s segments during optimization.
-- The original asset gets optimizationStatus='split'; segments point back via splitFromId.

ALTER TABLE "Asset"
  ADD COLUMN "splitFromId" TEXT,
  ADD COLUMN "splitIndex"  INTEGER;

ALTER TABLE "Asset"
  ADD CONSTRAINT "Asset_splitFromId_fkey"
  FOREIGN KEY ("splitFromId") REFERENCES "Asset"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Asset_splitFromId_idx" ON "Asset"("splitFromId");

-- AlterTable
ALTER TABLE "LeadImportBatch" ADD COLUMN "contentHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "LeadImportBatch_contentHash_key" ON "LeadImportBatch"("contentHash");

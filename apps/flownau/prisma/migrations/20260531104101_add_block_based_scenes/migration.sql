-- DropIndex
DROP INDEX "Asset_splitFromId_idx";

-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "scenes" JSONB;

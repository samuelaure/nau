-- AlterTable
ALTER TABLE "Asset" ADD COLUMN "duration" DOUBLE PRECISION;
ALTER TABLE "Asset" ADD COLUMN "description" TEXT;

-- AlterTable
ALTER TABLE "Template" DROP COLUMN IF EXISTS "airtableTableId";

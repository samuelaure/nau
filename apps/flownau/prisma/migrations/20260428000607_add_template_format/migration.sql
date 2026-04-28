-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "format" TEXT NOT NULL DEFAULT 'reel',
ALTER COLUMN "remotionId" SET DEFAULT '',
ALTER COLUMN "brandId" SET DEFAULT 'system',
ALTER COLUMN "scope" SET DEFAULT 'system';

-- AlterTable
ALTER TABLE "Template" ADD COLUMN "captionPrompt" TEXT;

-- AlterTable
ALTER TABLE "Composition" ADD COLUMN "caption" TEXT,
ADD COLUMN "externalPostId" TEXT,
ADD COLUMN "externalPostUrl" TEXT;

-- DropForeignKey
ALTER TABLE "Composition" DROP CONSTRAINT "Composition_templateId_fkey";

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "lastUsedAt" TIMESTAMP(3),
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "usageCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Composition" ADD COLUMN     "coverUrl" TEXT,
ADD COLUMN     "creative" JSONB,
ADD COLUMN     "format" TEXT NOT NULL DEFAULT 'reel',
ADD COLUMN     "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "ideaId" TEXT,
ADD COLUMN     "lastPublishError" TEXT,
ADD COLUMN     "publishAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sceneTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "scheduledAt" TIMESTAMP(3),
ADD COLUMN     "topicHash" TEXT,
ALTER COLUMN "templateId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ContentIdea" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'internal',
ADD COLUMN     "sourceRef" TEXT;

-- AlterTable
ALTER TABLE "PostingSchedule" ADD COLUMN     "postingTimes" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "reelsPerDay" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Europe/Madrid',
ADD COLUMN     "trialPostingTimes" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "trialReelsPerDay" INTEGER NOT NULL DEFAULT 5;

-- AlterTable
ALTER TABLE "SocialAccount" ADD COLUMN     "tokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "tokenRefreshedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "sceneType" TEXT,
ADD COLUMN     "slotSchema" JSONB,
ADD COLUMN     "styleConfig" JSONB;

-- CreateTable
CREATE TABLE "RenderJob" (
    "id" TEXT NOT NULL,
    "compositionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "outputUrl" TEXT,
    "outputType" TEXT NOT NULL DEFAULT 'video',
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "renderTimeMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RenderJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentPlan" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "pieces" JSONB NOT NULL,
    "scripts" JSONB,
    "delivered" BOOLEAN NOT NULL DEFAULT false,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RenderJob_compositionId_key" ON "RenderJob"("compositionId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentPlan_accountId_date_key" ON "ContentPlan"("accountId", "date");

-- AddForeignKey
ALTER TABLE "Composition" ADD CONSTRAINT "Composition_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Composition" ADD CONSTRAINT "Composition_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "ContentIdea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenderJob" ADD CONSTRAINT "RenderJob_compositionId_fkey" FOREIGN KEY ("compositionId") REFERENCES "Composition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPlan" ADD CONSTRAINT "ContentPlan_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

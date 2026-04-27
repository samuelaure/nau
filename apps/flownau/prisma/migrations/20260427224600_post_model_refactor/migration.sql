/*
  Warnings:

  - You are about to drop the column `compositionId` on the `RenderJob` table. All the data in the column will be lost.
  - You are about to drop the `Composition` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ContentIdea` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[postId]` on the table `RenderJob` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `postId` to the `RenderJob` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Composition" DROP CONSTRAINT "Composition_brandId_fkey";

-- DropForeignKey
ALTER TABLE "Composition" DROP CONSTRAINT "Composition_brandPersonaId_fkey";

-- DropForeignKey
ALTER TABLE "Composition" DROP CONSTRAINT "Composition_contentPrinciplesId_fkey";

-- DropForeignKey
ALTER TABLE "Composition" DROP CONSTRAINT "Composition_ideaId_fkey";

-- DropForeignKey
ALTER TABLE "Composition" DROP CONSTRAINT "Composition_ideasFrameworkId_fkey";

-- DropForeignKey
ALTER TABLE "Composition" DROP CONSTRAINT "Composition_templateId_fkey";

-- DropForeignKey
ALTER TABLE "ContentIdea" DROP CONSTRAINT "ContentIdea_brandId_fkey";

-- DropForeignKey
ALTER TABLE "ContentIdea" DROP CONSTRAINT "ContentIdea_brandPersonaId_fkey";

-- DropForeignKey
ALTER TABLE "ContentIdea" DROP CONSTRAINT "ContentIdea_contentPrinciplesId_fkey";

-- DropForeignKey
ALTER TABLE "ContentIdea" DROP CONSTRAINT "ContentIdea_ideasFrameworkId_fkey";

-- DropForeignKey
ALTER TABLE "RenderJob" DROP CONSTRAINT "RenderJob_compositionId_fkey";

-- DropIndex
DROP INDEX "RenderJob_compositionId_key";

-- AlterTable
ALTER TABLE "Brand" ADD COLUMN     "autoApproveIdeas" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "coverageHorizonDays" INTEGER NOT NULL DEFAULT 7;

-- AlterTable
ALTER TABLE "BrandTemplateConfig" ADD COLUMN     "autoApproveDraft" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "RenderJob" DROP COLUMN "compositionId",
ADD COLUMN     "postId" TEXT NOT NULL;

-- DropTable
DROP TABLE "Composition";

-- DropTable
DROP TABLE "ContentIdea";

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IDEA_PENDING',
    "ideaText" TEXT NOT NULL,
    "language" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "sourceRef" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 3,
    "generationBatchId" TEXT,
    "templateId" TEXT,
    "format" TEXT,
    "creative" JSONB,
    "payload" JSONB,
    "caption" TEXT,
    "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sceneTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "topicHash" TEXT,
    "userUploadedMediaUrl" TEXT,
    "brandPersonaId" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "videoUrl" TEXT,
    "coverUrl" TEXT,
    "externalPostId" TEXT,
    "externalPostUrl" TEXT,
    "publishAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastPublishError" TEXT,
    "userPostedManually" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Post_brandId_status_idx" ON "Post"("brandId", "status");

-- CreateIndex
CREATE INDEX "Post_generationBatchId_idx" ON "Post"("generationBatchId");

-- CreateIndex
CREATE INDEX "Post_scheduledAt_idx" ON "Post"("scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "RenderJob_postId_key" ON "RenderJob"("postId");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_brandPersonaId_fkey" FOREIGN KEY ("brandPersonaId") REFERENCES "BrandPersona"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenderJob" ADD CONSTRAINT "RenderJob_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

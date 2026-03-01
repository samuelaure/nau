/*
  Warnings:

  - You are about to drop the column `prompt` on the `Composition` table. All the data in the column will be lost.
  - You are about to drop the column `schemaJson` on the `Composition` table. All the data in the column will be lost.
  - Added the required column `payload` to the `Composition` table without a default value. This is not possible if the table is not empty.
  - Added the required column `templateId` to the `Composition` table without a default value. This is not possible if the table is not empty.

*/
-- Delete existing compositions to allow adding required columns
DELETE FROM "Composition";

-- AlterTable
ALTER TABLE "Composition" DROP COLUMN "prompt",
DROP COLUMN "schemaJson",
ADD COLUMN     "payload" JSONB NOT NULL,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "templateId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "BrandPersona" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "ideasFrameworkPrompt" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "autoApproveIdeas" BOOLEAN NOT NULL DEFAULT false,
    "autoApproveCompositions" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BrandPersona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "contentPrompt" TEXT NOT NULL,
    "schemaJson" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "autoApproveCompositions" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentIdea" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "ideaText" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentIdea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostingSchedule" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "frequencyDays" INTEGER NOT NULL DEFAULT 1,
    "lastPostedAt" TIMESTAMP(3),

    CONSTRAINT "PostingSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PostingSchedule_accountId_key" ON "PostingSchedule"("accountId");

-- AddForeignKey
ALTER TABLE "BrandPersona" ADD CONSTRAINT "BrandPersona_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentIdea" ADD CONSTRAINT "ContentIdea_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Composition" ADD CONSTRAINT "Composition_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "VideoTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostingSchedule" ADD CONSTRAINT "PostingSchedule_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

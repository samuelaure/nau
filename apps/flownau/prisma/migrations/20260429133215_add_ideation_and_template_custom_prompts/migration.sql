/*
  Warnings:

  - You are about to drop the column `creationPrompt` on the `Brand` table. All the data in the column will be lost.
  - You are about to drop the column `directorPrompt` on the `Brand` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Brand" DROP COLUMN "creationPrompt",
DROP COLUMN "directorPrompt",
ADD COLUMN     "ideationPrompt" TEXT;

-- AlterTable
ALTER TABLE "BrandTemplateConfig" ADD COLUMN     "customPrompt" TEXT;

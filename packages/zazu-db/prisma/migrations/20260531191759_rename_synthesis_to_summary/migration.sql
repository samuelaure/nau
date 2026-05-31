/*
  Warnings:

  - You are about to drop the column `synthesis` on the `Voicenote` table. All the data in the column will be lost.
  - Added the required column `summary` to the `Voicenote` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Voicenote" DROP COLUMN "synthesis",
ADD COLUMN     "summary" TEXT NOT NULL;

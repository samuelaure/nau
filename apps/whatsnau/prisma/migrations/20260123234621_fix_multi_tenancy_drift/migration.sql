-- DropIndex
DROP INDEX "Lead_phoneNumber_key";

-- DropIndex
DROP INDEX "Tag_name_key";

-- DropIndex
DROP INDEX "TakeoverKeyword_word_key";

-- AlterTable
ALTER TABLE "BusinessProfile" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GlobalConfig" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TelegramConfig" ALTER COLUMN "id" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "Campaign_tenantId_isActive_idx" ON "Campaign"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "Lead_tenantId_state_idx" ON "Lead"("tenantId", "state");

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- Insert default tenant for existing data
INSERT INTO "Tenant" ("id", "name", "slug", "isDemo", "createdAt", "updatedAt")
VALUES ('default-tenant-id', 'Default Tenant', 'default', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- AlterTable User: Add tenantId with default, then make it required
ALTER TABLE "User" ADD COLUMN "tenantId" TEXT DEFAULT 'default-tenant-id';
UPDATE "User" SET "tenantId" = 'default-tenant-id' WHERE "tenantId" IS NULL;
ALTER TABLE "User" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "tenantId" DROP DEFAULT;

-- AlterTable Campaign
ALTER TABLE "Campaign" ADD COLUMN "tenantId" TEXT DEFAULT 'default-tenant-id';
UPDATE "Campaign" SET "tenantId" = 'default-tenant-id' WHERE "tenantId" IS NULL;
ALTER TABLE "Campaign" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Campaign" ALTER COLUMN "tenantId" DROP DEFAULT;

-- AlterTable Lead
ALTER TABLE "Lead" ADD COLUMN "tenantId" TEXT DEFAULT 'default-tenant-id';
UPDATE "Lead" SET "tenantId" = 'default-tenant-id' WHERE "tenantId" IS NULL;
ALTER TABLE "Lead" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Lead" ALTER COLUMN "tenantId" DROP DEFAULT;

-- AlterTable Tag
ALTER TABLE "Tag" ADD COLUMN "tenantId" TEXT DEFAULT 'default-tenant-id';
UPDATE "Tag" SET "tenantId" = 'default-tenant-id' WHERE "tenantId" IS NULL;
ALTER TABLE "Tag" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Tag" ALTER COLUMN "tenantId" DROP DEFAULT;

-- AlterTable WhatsAppConfig
ALTER TABLE "WhatsAppConfig" ADD COLUMN "tenantId" TEXT DEFAULT 'default-tenant-id';
UPDATE "WhatsAppConfig" SET "tenantId" = 'default-tenant-id' WHERE "tenantId" IS NULL;
ALTER TABLE "WhatsAppConfig" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "WhatsAppConfig" ALTER COLUMN "tenantId" DROP DEFAULT;

-- AlterTable GlobalConfig
ALTER TABLE "GlobalConfig" ADD COLUMN "tenantId" TEXT DEFAULT 'default-tenant-id';
UPDATE "GlobalConfig" SET "tenantId" = 'default-tenant-id' WHERE "tenantId" IS NULL;
ALTER TABLE "GlobalConfig" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "GlobalConfig" ALTER COLUMN "tenantId" DROP DEFAULT;

-- AlterTable BusinessProfile
ALTER TABLE "BusinessProfile" ADD COLUMN "tenantId" TEXT DEFAULT 'default-tenant-id';
UPDATE "BusinessProfile" SET "tenantId" = 'default-tenant-id' WHERE "tenantId" IS NULL;
ALTER TABLE "BusinessProfile" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "BusinessProfile" ALTER COLUMN "tenantId" DROP DEFAULT;

-- AlterTable TelegramConfig
ALTER TABLE "TelegramConfig" ADD COLUMN "tenantId" TEXT DEFAULT 'default-tenant-id';
UPDATE "TelegramConfig" SET "tenantId" = 'default-tenant-id' WHERE "tenantId" IS NULL;
ALTER TABLE "TelegramConfig" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "TelegramConfig" ALTER COLUMN "tenantId" DROP DEFAULT;

-- AlterTable LeadImportBatch
ALTER TABLE "LeadImportBatch" ADD COLUMN "tenantId" TEXT DEFAULT 'default-tenant-id';
UPDATE "LeadImportBatch" SET "tenantId" = 'default-tenant-id' WHERE "tenantId" IS NULL;
ALTER TABLE "LeadImportBatch" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "LeadImportBatch" ALTER COLUMN "tenantId" DROP DEFAULT;

-- AlterTable StagingLead
ALTER TABLE "StagingLead" ADD COLUMN "tenantId" TEXT DEFAULT 'default-tenant-id';
UPDATE "StagingLead" SET "tenantId" = 'default-tenant-id' WHERE "tenantId" IS NULL;
ALTER TABLE "StagingLead" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "StagingLead" ALTER COLUMN "tenantId" DROP DEFAULT;

-- AlterTable TakeoverKeyword
ALTER TABLE "TakeoverKeyword" ADD COLUMN "tenantId" TEXT DEFAULT 'default-tenant-id';
UPDATE "TakeoverKeyword" SET "tenantId" = 'default-tenant-id' WHERE "tenantId" IS NULL;
ALTER TABLE "TakeoverKeyword" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "TakeoverKeyword" ALTER COLUMN "tenantId" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");
CREATE INDEX "Campaign_tenantId_idx" ON "Campaign"("tenantId");
CREATE INDEX "Lead_tenantId_idx" ON "Lead"("tenantId");
CREATE INDEX "Tag_tenantId_idx" ON "Tag"("tenantId");
CREATE INDEX "WhatsAppConfig_tenantId_idx" ON "WhatsAppConfig"("tenantId");
CREATE INDEX "LeadImportBatch_tenantId_idx" ON "LeadImportBatch"("tenantId");
CREATE INDEX "StagingLead_tenantId_idx" ON "StagingLead"("tenantId");
CREATE INDEX "TakeoverKeyword_tenantId_idx" ON "TakeoverKeyword"("tenantId");

-- CreateIndex (Unique constraints for singleton models)
CREATE UNIQUE INDEX "GlobalConfig_tenantId_key" ON "GlobalConfig"("tenantId");
CREATE UNIQUE INDEX "BusinessProfile_tenantId_key" ON "BusinessProfile"("tenantId");
CREATE UNIQUE INDEX "TelegramConfig_tenantId_key" ON "TelegramConfig"("tenantId");

-- CreateIndex (Unique constraints for tenant-scoped uniqueness)
CREATE UNIQUE INDEX "Lead_tenantId_phoneNumber_key" ON "Lead"("tenantId", "phoneNumber");
CREATE UNIQUE INDEX "Tag_tenantId_name_key" ON "Tag"("tenantId", "name");
CREATE UNIQUE INDEX "TakeoverKeyword_tenantId_word_key" ON "TakeoverKeyword"("tenantId", "word");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WhatsAppConfig" ADD CONSTRAINT "WhatsAppConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GlobalConfig" ADD CONSTRAINT "GlobalConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BusinessProfile" ADD CONSTRAINT "BusinessProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TelegramConfig" ADD CONSTRAINT "TelegramConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeadImportBatch" ADD CONSTRAINT "LeadImportBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StagingLead" ADD CONSTRAINT "StagingLead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TakeoverKeyword" ADD CONSTRAINT "TakeoverKeyword_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

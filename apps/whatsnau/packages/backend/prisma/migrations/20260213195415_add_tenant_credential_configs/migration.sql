/*
  Warnings:

  - You are about to drop the column `botToken` on the `TelegramConfig` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "TelegramConfig" DROP COLUMN "botToken";

-- CreateTable
CREATE TABLE "YCloudConfig" (
    "id" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YCloudConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpenAIConfig" (
    "id" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "primaryModel" TEXT NOT NULL DEFAULT 'gpt-4o',
    "cheapModel" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpenAIConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "YCloudConfig_tenantId_idx" ON "YCloudConfig"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "YCloudConfig_tenantId_isDefault_key" ON "YCloudConfig"("tenantId", "isDefault");

-- CreateIndex
CREATE INDEX "OpenAIConfig_tenantId_idx" ON "OpenAIConfig"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "OpenAIConfig_tenantId_isDefault_key" ON "OpenAIConfig"("tenantId", "isDefault");

-- AddForeignKey
ALTER TABLE "YCloudConfig" ADD CONSTRAINT "YCloudConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenAIConfig" ADD CONSTRAINT "OpenAIConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

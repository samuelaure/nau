/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,phoneNumberId]` on the table `WhatsAppConfig` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppConfig_tenantId_phoneNumberId_key" ON "WhatsAppConfig"("tenantId", "phoneNumberId");

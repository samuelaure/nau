-- AlterTable
ALTER TABLE "GlobalConfig" ADD COLUMN     "alertCooldownMinutes" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "defaultDemoDurationMinutes" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "maxUnansweredMessages" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "telegramAlertsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "SystemAlert" (
    "id" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "context" JSONB,
    "tenantId" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "SystemAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceMetric" (
    "id" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerformanceMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SystemAlert_severity_resolved_idx" ON "SystemAlert"("severity", "resolved");

-- CreateIndex
CREATE INDEX "SystemAlert_tenantId_idx" ON "SystemAlert"("tenantId");

-- CreateIndex
CREATE INDEX "PerformanceMetric_operation_createdAt_idx" ON "PerformanceMetric"("operation", "createdAt");

-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "brandId" TEXT,
    "userId" TEXT,
    "service" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "model" TEXT,
    "provider" TEXT,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "costUsd" DOUBLE PRECISION,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UsageEvent_workspaceId_createdAt_idx" ON "UsageEvent"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "UsageEvent_brandId_createdAt_idx" ON "UsageEvent"("brandId", "createdAt");

-- CreateIndex
CREATE INDEX "UsageEvent_service_operation_createdAt_idx" ON "UsageEvent"("service", "operation", "createdAt");

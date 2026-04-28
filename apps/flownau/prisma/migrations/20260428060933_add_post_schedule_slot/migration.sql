-- CreateTable
CREATE TABLE "PostSchedule" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "formatChain" TEXT[],
    "chainPosition" INTEGER NOT NULL DEFAULT 0,
    "dailyFrequency" INTEGER NOT NULL DEFAULT 1,
    "windowStart" TEXT NOT NULL DEFAULT '09:00',
    "windowEnd" TEXT NOT NULL DEFAULT '21:00',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostSlot" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "format" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'empty',
    "postId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PostSchedule_brandId_key" ON "PostSchedule"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "PostSlot_postId_key" ON "PostSlot"("postId");

-- CreateIndex
CREATE INDEX "PostSlot_brandId_scheduledAt_idx" ON "PostSlot"("brandId", "scheduledAt");

-- CreateIndex
CREATE INDEX "PostSlot_brandId_status_idx" ON "PostSlot"("brandId", "status");

-- AddForeignKey
ALTER TABLE "PostSchedule" ADD CONSTRAINT "PostSchedule_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostSlot" ADD CONSTRAINT "PostSlot_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostSlot" ADD CONSTRAINT "PostSlot_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "SourceConcept" (
    "id"         TEXT NOT NULL,
    "brandId"    TEXT NOT NULL,
    "content"    TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'inspo_base',
    "status"     TEXT NOT NULL DEFAULT 'pending',
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "SourceConcept_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SourceConcept"
    ADD CONSTRAINT "SourceConcept_brandId_fkey"
    FOREIGN KEY ("brandId") REFERENCES "Brand"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "SourceConcept_brandId_status_idx" ON "SourceConcept"("brandId", "status");

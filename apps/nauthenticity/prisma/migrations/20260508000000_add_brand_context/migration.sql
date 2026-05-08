-- CreateTable
CREATE TABLE "BrandContext" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "content" JSONB,
    "sources" JSONB,
    "generatedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandContext_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrandContext_brandId_key" ON "BrandContext"("brandId");

-- AddForeignKey
ALTER TABLE "BrandContext" ADD CONSTRAINT "BrandContext_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

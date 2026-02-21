-- CreateTable
CREATE TABLE "Composition" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "prompt" TEXT,
    "schemaJson" JSONB NOT NULL,
    "videoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Composition_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Composition" ADD CONSTRAINT "Composition_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

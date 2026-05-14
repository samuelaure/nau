-- CreateTable
CREATE TABLE IF NOT EXISTS "TrashItem" (
    "id"               TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "brandId"          TEXT NOT NULL,
    "socialProfileId"  TEXT,
    "postId"           TEXT,
    "originalCategory" TEXT NOT NULL,
    "deletedAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),
    "expiresAt"        TIMESTAMPTZ NOT NULL,

    CONSTRAINT "TrashItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TrashItem" ADD CONSTRAINT "TrashItem_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrashItem" ADD CONSTRAINT "TrashItem_socialProfileId_fkey"
  FOREIGN KEY ("socialProfileId") REFERENCES "SocialProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrashItem" ADD CONSTRAINT "TrashItem_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TrashItem_brandId_idx" ON "TrashItem"("brandId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TrashItem_expiresAt_idx" ON "TrashItem"("expiresAt");

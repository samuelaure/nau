-- Add externalId to SocialProfile for stable deduplication by Instagram's numeric profile ID.
-- Username is mutable; externalId never changes.
-- Partial unique index: only enforces uniqueness when externalId is set (NULL rows are excluded).

ALTER TABLE "SocialProfile" ADD COLUMN "externalId" TEXT;

CREATE UNIQUE INDEX "SocialProfile_platform_externalId_key"
  ON "SocialProfile"("platform", "externalId")
  WHERE "externalId" IS NOT NULL;

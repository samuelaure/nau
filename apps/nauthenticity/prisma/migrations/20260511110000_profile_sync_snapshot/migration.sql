CREATE TABLE "ProfileSyncSnapshot" (
  "id"              TEXT NOT NULL,
  "socialProfileId" TEXT NOT NULL,
  "igPostCount"     INTEGER NOT NULL,
  "nauPostCount"    INTEGER NOT NULL,
  "scrapeTriggered" BOOLEAN NOT NULL DEFAULT false,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProfileSyncSnapshot_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ProfileSyncSnapshot"
  ADD CONSTRAINT "ProfileSyncSnapshot_socialProfileId_fkey"
  FOREIGN KEY ("socialProfileId") REFERENCES "SocialProfile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ProfileSyncSnapshot_socialProfileId_createdAt_idx"
  ON "ProfileSyncSnapshot"("socialProfileId", "createdAt" DESC);

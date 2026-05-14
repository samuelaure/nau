-- AddColumn: SocialProfile.synthesisTriggerThreshold
ALTER TABLE "SocialProfile" ADD COLUMN "synthesisTriggerThreshold" INTEGER NOT NULL DEFAULT 36;

-- CreateEnum: FreshnessUnit
CREATE TYPE "FreshnessUnit" AS ENUM ('WEEKS', 'MONTHS');

-- AddColumns: Brand freshness settings
ALTER TABLE "Brand" ADD COLUMN "sourceConceptFreshnessPeriod" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "Brand" ADD COLUMN "sourceConceptFreshnessUnit" "FreshnessUnit" NOT NULL DEFAULT 'WEEKS';

-- CreateTable: SourceConceptSource
CREATE TABLE "SourceConceptSource" (
    "id" TEXT NOT NULL,
    "sourceConceptId" TEXT NOT NULL,
    "postId" TEXT,
    "socialProfileId" TEXT,

    CONSTRAINT "SourceConceptSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for SourceConceptSource
CREATE INDEX "SourceConceptSource_sourceConceptId_idx" ON "SourceConceptSource"("sourceConceptId");
CREATE INDEX "SourceConceptSource_postId_idx" ON "SourceConceptSource"("postId");
CREATE INDEX "SourceConceptSource_socialProfileId_idx" ON "SourceConceptSource"("socialProfileId");

-- AddForeignKeys for SourceConceptSource
ALTER TABLE "SourceConceptSource" ADD CONSTRAINT "SourceConceptSource_sourceConceptId_fkey"
    FOREIGN KEY ("sourceConceptId") REFERENCES "SourceConcept"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SourceConceptSource" ADD CONSTRAINT "SourceConceptSource_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SourceConceptSource" ADD CONSTRAINT "SourceConceptSource_socialProfileId_fkey"
    FOREIGN KEY ("socialProfileId") REFERENCES "SocialProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: ProfileSynthesis
CREATE TABLE "ProfileSynthesis" (
    "id" TEXT NOT NULL,
    "socialProfileId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "postCountAtGeneration" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileSynthesis_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex for ProfileSynthesis
CREATE UNIQUE INDEX "ProfileSynthesis_socialProfileId_key" ON "ProfileSynthesis"("socialProfileId");

-- AddForeignKey for ProfileSynthesis
ALTER TABLE "ProfileSynthesis" ADD CONSTRAINT "ProfileSynthesis_socialProfileId_fkey"
    FOREIGN KEY ("socialProfileId") REFERENCES "SocialProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: ProfileSynthesisHistory
CREATE TABLE "ProfileSynthesisHistory" (
    "id" TEXT NOT NULL,
    "socialProfileId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "postCountAtGeneration" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileSynthesisHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for ProfileSynthesisHistory
CREATE INDEX "ProfileSynthesisHistory_socialProfileId_archivedAt_idx" ON "ProfileSynthesisHistory"("socialProfileId", "archivedAt" DESC);

-- AddForeignKey for ProfileSynthesisHistory
ALTER TABLE "ProfileSynthesisHistory" ADD CONSTRAINT "ProfileSynthesisHistory_socialProfileId_fkey"
    FOREIGN KEY ("socialProfileId") REFERENCES "SocialProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateTable
CREATE TABLE "SocialProfile" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'instagram',
    "username" TEXT NOT NULL,
    "profileImageUrl" TEXT,
    "lastScrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerId" TEXT,

    CONSTRAINT "SocialProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "instagramId" TEXT,
    "instagramUrl" TEXT NOT NULL,
    "username" TEXT,
    "socialProfileId" TEXT,
    "caption" TEXT,
    "originalCaption" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER,
    "engagementScore" DOUBLE PRECISION,
    "collaborators" JSONB,
    "intelligence" JSONB,
    "runId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapingRun" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "actorRunId" TEXT,
    "datasetId" TEXT,
    "rawData" JSONB,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "phase" TEXT NOT NULL DEFAULT 'finished',
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScrapingRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT,
    "storageUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "duration" DOUBLE PRECISION,
    "index" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transcript" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "mediaId" TEXT,
    "text" TEXT NOT NULL,
    "originalText" TEXT,
    "json" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transcript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Embedding" (
    "id" TEXT NOT NULL,
    "transcriptId" TEXT NOT NULL,
    "vector" vector(1536) NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'text-embedding-3-small',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Embedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeChunk" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "brandId" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'transcript',
    "sourceId" TEXT,
    "chunkIndex" INTEGER NOT NULL DEFAULT 0,
    "text" TEXT NOT NULL,
    "vector" vector(1536) NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'text-embedding-3-small',
    "transcriptId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL DEFAULT '',
    "mainUsername" TEXT,
    "voicePrompt" TEXT NOT NULL,
    "commentStrategy" TEXT,
    "suggestionsCount" INTEGER NOT NULL DEFAULT 3,
    "windowStart" TEXT,
    "windowEnd" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "inspoRequestCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandSynthesis" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "attachedUrls" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandSynthesis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialProfileMonitor" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "socialProfileId" TEXT NOT NULL,
    "monitoringType" TEXT NOT NULL DEFAULT 'content',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialProfileMonitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommentFeedback" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "commentText" TEXT NOT NULL,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspoItem" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "postId" TEXT,
    "sourceUrl" TEXT,
    "type" TEXT NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "extractedHook" TEXT,
    "extractedTheme" TEXT,
    "adaptedScript" TEXT,
    "injectedContext" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspoItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SocialProfile_platform_username_idx" ON "SocialProfile"("platform", "username");

-- CreateIndex
CREATE INDEX "SocialProfile_ownerId_idx" ON "SocialProfile"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialProfile_platform_username_key" ON "SocialProfile"("platform", "username");

-- CreateIndex
CREATE UNIQUE INDEX "Post_instagramId_key" ON "Post"("instagramId");

-- CreateIndex
CREATE UNIQUE INDEX "Post_instagramUrl_key" ON "Post"("instagramUrl");

-- CreateIndex
CREATE INDEX "Post_socialProfileId_postedAt_idx" ON "Post"("socialProfileId", "postedAt" DESC);

-- CreateIndex
CREATE INDEX "Post_username_postedAt_idx" ON "Post"("username", "postedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ScrapingRun_actorRunId_key" ON "ScrapingRun"("actorRunId");

-- CreateIndex
CREATE INDEX "Media_postId_idx" ON "Media"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "Transcript_mediaId_key" ON "Transcript"("mediaId");

-- CreateIndex
CREATE INDEX "Transcript_postId_idx" ON "Transcript"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "Embedding_transcriptId_key" ON "Embedding"("transcriptId");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_platform_platformId_idx" ON "KnowledgeChunk"("platform", "platformId");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_brandId_idx" ON "KnowledgeChunk"("brandId");

-- CreateIndex
CREATE INDEX "Brand_workspaceId_idx" ON "Brand"("workspaceId");

-- CreateIndex
CREATE INDEX "BrandSynthesis_brandId_type_idx" ON "BrandSynthesis"("brandId", "type");

-- CreateIndex
CREATE INDEX "SocialProfileMonitor_brandId_idx" ON "SocialProfileMonitor"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialProfileMonitor_brandId_socialProfileId_key" ON "SocialProfileMonitor"("brandId", "socialProfileId");

-- CreateIndex
CREATE INDEX "CommentFeedback_brandId_idx" ON "CommentFeedback"("brandId");

-- CreateIndex
CREATE INDEX "InspoItem_brandId_idx" ON "InspoItem"("brandId");

-- CreateIndex
CREATE INDEX "InspoItem_brandId_status_idx" ON "InspoItem"("brandId", "status");

-- AddForeignKey
ALTER TABLE "SocialProfile" ADD CONSTRAINT "SocialProfile_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_socialProfileId_fkey" FOREIGN KEY ("socialProfileId") REFERENCES "SocialProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ScrapingRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transcript" ADD CONSTRAINT "Transcript_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transcript" ADD CONSTRAINT "Transcript_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Embedding" ADD CONSTRAINT "Embedding_transcriptId_fkey" FOREIGN KEY ("transcriptId") REFERENCES "Transcript"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_transcriptId_fkey" FOREIGN KEY ("transcriptId") REFERENCES "Transcript"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandSynthesis" ADD CONSTRAINT "BrandSynthesis_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialProfileMonitor" ADD CONSTRAINT "SocialProfileMonitor_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialProfileMonitor" ADD CONSTRAINT "SocialProfileMonitor_socialProfileId_fkey" FOREIGN KEY ("socialProfileId") REFERENCES "SocialProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentFeedback" ADD CONSTRAINT "CommentFeedback_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentFeedback" ADD CONSTRAINT "CommentFeedback_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspoItem" ADD CONSTRAINT "InspoItem_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspoItem" ADD CONSTRAINT "InspoItem_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

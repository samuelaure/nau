-- CreateEnum
CREATE TYPE "AIModel" AS ENUM ('GROQ_LLAMA_3_3', 'GROQ_LLAMA_3_1_70B', 'GROQ_LLAMA_3_1_8B', 'GROQ_MIXTRAL_8X7B', 'GROQ_DEEPSEEK_R1_70B', 'OPENAI_GPT_4O', 'OPENAI_GPT_4O_MINI', 'OPENAI_GPT_4_TURBO', 'OPENAI_GPT_4_1', 'OPENAI_O1', 'OPENAI_O1_MINI');

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT,
    "shortCode" TEXT,
    "assetsRoot" TEXT,
    "language" TEXT NOT NULL DEFAULT 'Spanish',
    "ideationCount" INTEGER NOT NULL DEFAULT 9,
    "autoApproveIdeas" BOOLEAN NOT NULL DEFAULT false,
    "coverageHorizonDays" INTEGER NOT NULL DEFAULT 7,
    "ideationPrompt" TEXT,
    "composerPrompt" TEXT,
    "brandIdentity" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "SocialProfile" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'instagram',
    "platformId" TEXT,
    "username" TEXT,
    "profileImage" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "tokenExpiresAt" TIMESTAMP(3),
    "tokenRefreshedAt" TIMESTAMP(3),
    "syncedFromNauthenticity" BOOLEAN NOT NULL DEFAULT false,
    "nauthenticityProfileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "brandId" TEXT,
    "templateId" TEXT,
    "type" TEXT NOT NULL,
    "systemFilename" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "r2Key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "hash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "thumbnailUrl" TEXT,
    "duration" DOUBLE PRECISION,
    "description" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastUsedAt" TIMESTAMP(3),
    "usageCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'reel',
    "remotionId" TEXT NOT NULL DEFAULT '',
    "config" JSONB,
    "brandId" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'system',
    "useBrandAssets" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "assetsRoot" TEXT,
    "systemPrompt" TEXT,
    "creationPrompt" TEXT,
    "captionPrompt" TEXT,
    "schemaJson" JSONB,
    "contentSchema" JSONB,
    "sceneType" TEXT,
    "slotSchema" JSONB,
    "styleConfig" JSONB,
    "description" TEXT,
    "previewUrl" TEXT,
    "previewThumbnailUrl" TEXT,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandTemplateConfig" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "autoApproveDraft" BOOLEAN NOT NULL DEFAULT false,
    "autoApprovePost" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "customPrompt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandTemplateConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Render" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IDLE',
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "inputData" JSONB,
    "r2Url" TEXT,
    "instagramMediaId" TEXT,
    "instagramStatus" TEXT,
    "error" TEXT,
    "renderLog" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Render_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "BrandPersona" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "modelSelection" "AIModel" NOT NULL DEFAULT 'GROQ_LLAMA_3_3',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "autoApproveIdeas" BOOLEAN NOT NULL DEFAULT false,
    "autoApproveCompositions" BOOLEAN NOT NULL DEFAULT false,
    "autoApprovePool" BOOLEAN NOT NULL DEFAULT false,
    "capturedAutoApprove" BOOLEAN NOT NULL DEFAULT false,
    "capturedCount" INTEGER NOT NULL DEFAULT 3,
    "manualAutoApprove" BOOLEAN NOT NULL DEFAULT false,
    "manualCount" INTEGER NOT NULL DEFAULT 5,
    "automaticAutoApprove" BOOLEAN NOT NULL DEFAULT false,
    "automaticCount" INTEGER NOT NULL DEFAULT 5,

    CONSTRAINT "BrandPersona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdeasFramework" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdeasFramework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentCreationPrinciples" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentCreationPrinciples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IDEA_PENDING',
    "ideaText" TEXT NOT NULL,
    "language" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "sourceRef" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 3,
    "generationBatchId" TEXT,
    "templateId" TEXT,
    "format" TEXT,
    "creative" JSONB,
    "payload" JSONB,
    "caption" TEXT,
    "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sceneTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "topicHash" TEXT,
    "userUploadedMediaUrl" TEXT,
    "brandPersonaId" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "videoUrl" TEXT,
    "coverUrl" TEXT,
    "externalPostId" TEXT,
    "externalPostUrl" TEXT,
    "publishAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastPublishError" TEXT,
    "userPostedManually" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "llmTrace" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RenderJob" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "outputUrl" TEXT,
    "outputType" TEXT NOT NULL DEFAULT 'video',
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "renderTimeMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RenderJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentPlan" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "pieces" JSONB NOT NULL,
    "scripts" JSONB,
    "delivered" BOOLEAN NOT NULL DEFAULT false,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentPlanner" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "autoApproveSchedule" BOOLEAN NOT NULL DEFAULT false,
    "strategistPrompt" TEXT,
    "daysToPlan" INTEGER NOT NULL DEFAULT 7,
    "frequencyDays" INTEGER NOT NULL DEFAULT 1,
    "reelsPerDay" INTEGER NOT NULL DEFAULT 5,
    "trialReelsPerDay" INTEGER NOT NULL DEFAULT 5,
    "postingTimes" JSONB NOT NULL DEFAULT '[]',
    "trialPostingTimes" JSONB NOT NULL DEFAULT '[]',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Madrid',
    "lastPostedAt" TIMESTAMP(3),

    CONSTRAINT "ContentPlanner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PostSchedule_brandId_key" ON "PostSchedule"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "PostSlot_postId_key" ON "PostSlot"("postId");

-- CreateIndex
CREATE INDEX "PostSlot_brandId_status_idx" ON "PostSlot"("brandId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PostSlot_brandId_scheduledAt_key" ON "PostSlot"("brandId", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "SocialProfile_platform_platformId_key" ON "SocialProfile"("platform", "platformId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandTemplateConfig_brandId_templateId_key" ON "BrandTemplateConfig"("brandId", "templateId");

-- CreateIndex
CREATE INDEX "Post_brandId_status_idx" ON "Post"("brandId", "status");

-- CreateIndex
CREATE INDEX "Post_generationBatchId_idx" ON "Post"("generationBatchId");

-- CreateIndex
CREATE INDEX "Post_scheduledAt_idx" ON "Post"("scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "RenderJob_postId_key" ON "RenderJob"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentPlan_brandId_date_key" ON "ContentPlan"("brandId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ContentPlanner_brandId_name_key" ON "ContentPlanner"("brandId", "name");

-- AddForeignKey
ALTER TABLE "PostSchedule" ADD CONSTRAINT "PostSchedule_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostSlot" ADD CONSTRAINT "PostSlot_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostSlot" ADD CONSTRAINT "PostSlot_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialProfile" ADD CONSTRAINT "SocialProfile_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandTemplateConfig" ADD CONSTRAINT "BrandTemplateConfig_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandTemplateConfig" ADD CONSTRAINT "BrandTemplateConfig_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Render" ADD CONSTRAINT "Render_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_brandPersonaId_fkey" FOREIGN KEY ("brandPersonaId") REFERENCES "BrandPersona"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenderJob" ADD CONSTRAINT "RenderJob_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPlan" ADD CONSTRAINT "ContentPlan_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

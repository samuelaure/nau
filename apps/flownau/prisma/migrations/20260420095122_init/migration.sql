-- CreateEnum
CREATE TYPE "AIModel" AS ENUM ('GROQ_LLAMA_3_3', 'GROQ_LLAMA_3_1_70B', 'GROQ_LLAMA_3_1_8B', 'GROQ_MIXTRAL_8X7B', 'GROQ_DEEPSEEK_R1_70B', 'OPENAI_GPT_4O', 'OPENAI_GPT_4O_MINI', 'OPENAI_GPT_4_TURBO', 'OPENAI_GPT_4_1', 'OPENAI_O1', 'OPENAI_O1_MINI');

-- CreateTable
CREATE TABLE "SocialAccount" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "brandId" TEXT,
    "platform" TEXT NOT NULL DEFAULT 'instagram',
    "platformId" TEXT,
    "username" TEXT,
    "profileImage" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "directorPrompt" TEXT,
    "creationPrompt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "shortCode" TEXT,
    "assetsRoot" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "tokenRefreshedAt" TIMESTAMP(3),

    CONSTRAINT "SocialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "accountId" TEXT,
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
    "remotionId" TEXT NOT NULL,
    "config" JSONB,
    "accountId" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'account',
    "useAccountAssets" BOOLEAN NOT NULL DEFAULT true,
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

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountTemplateConfig" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "autoApprovePost" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountTemplateConfig_pkey" PRIMARY KEY ("id")
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
    "accountId" TEXT,
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
    "accountId" TEXT,
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
    "accountId" TEXT,
    "name" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentCreationPrinciples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentIdea" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "ideaText" TEXT NOT NULL,
    "format" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "source" TEXT NOT NULL DEFAULT 'automatic',
    "sourceRef" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 3,
    "aiLinked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "brandPersonaId" TEXT,
    "ideasFrameworkId" TEXT,
    "contentPrinciplesId" TEXT,

    CONSTRAINT "ContentIdea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Composition" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "templateId" TEXT,
    "format" TEXT NOT NULL DEFAULT 'reel',
    "creative" JSONB,
    "payload" JSONB NOT NULL,
    "videoUrl" TEXT,
    "coverUrl" TEXT,
    "caption" TEXT,
    "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "externalPostId" TEXT,
    "externalPostUrl" TEXT,
    "source" TEXT NOT NULL DEFAULT 'composed',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "publishAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastPublishError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ideaId" TEXT,
    "sceneTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "topicHash" TEXT,
    "brandPersonaId" TEXT,
    "ideasFrameworkId" TEXT,
    "contentPrinciplesId" TEXT,
    "userUploadedMediaUrl" TEXT,
    "userPostedManually" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Composition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RenderJob" (
    "id" TEXT NOT NULL,
    "compositionId" TEXT NOT NULL,
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
    "accountId" TEXT NOT NULL,
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
    "accountId" TEXT,
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
CREATE UNIQUE INDEX "SocialAccount_platform_platformId_key" ON "SocialAccount"("platform", "platformId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountTemplateConfig_accountId_templateId_key" ON "AccountTemplateConfig"("accountId", "templateId");

-- CreateIndex
CREATE UNIQUE INDEX "RenderJob_compositionId_key" ON "RenderJob"("compositionId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentPlan_accountId_date_key" ON "ContentPlan"("accountId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ContentPlanner_brandId_name_key" ON "ContentPlanner"("brandId", "name");

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountTemplateConfig" ADD CONSTRAINT "AccountTemplateConfig_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountTemplateConfig" ADD CONSTRAINT "AccountTemplateConfig_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Render" ADD CONSTRAINT "Render_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandPersona" ADD CONSTRAINT "BrandPersona_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeasFramework" ADD CONSTRAINT "IdeasFramework_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentCreationPrinciples" ADD CONSTRAINT "ContentCreationPrinciples_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentIdea" ADD CONSTRAINT "ContentIdea_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentIdea" ADD CONSTRAINT "ContentIdea_brandPersonaId_fkey" FOREIGN KEY ("brandPersonaId") REFERENCES "BrandPersona"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentIdea" ADD CONSTRAINT "ContentIdea_ideasFrameworkId_fkey" FOREIGN KEY ("ideasFrameworkId") REFERENCES "IdeasFramework"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentIdea" ADD CONSTRAINT "ContentIdea_contentPrinciplesId_fkey" FOREIGN KEY ("contentPrinciplesId") REFERENCES "ContentCreationPrinciples"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Composition" ADD CONSTRAINT "Composition_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Composition" ADD CONSTRAINT "Composition_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Composition" ADD CONSTRAINT "Composition_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "ContentIdea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Composition" ADD CONSTRAINT "Composition_brandPersonaId_fkey" FOREIGN KEY ("brandPersonaId") REFERENCES "BrandPersona"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Composition" ADD CONSTRAINT "Composition_ideasFrameworkId_fkey" FOREIGN KEY ("ideasFrameworkId") REFERENCES "IdeasFramework"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Composition" ADD CONSTRAINT "Composition_contentPrinciplesId_fkey" FOREIGN KEY ("contentPrinciplesId") REFERENCES "ContentCreationPrinciples"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenderJob" ADD CONSTRAINT "RenderJob_compositionId_fkey" FOREIGN KEY ("compositionId") REFERENCES "Composition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPlan" ADD CONSTRAINT "ContentPlan_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPlanner" ADD CONSTRAINT "ContentPlanner_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

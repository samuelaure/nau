-- Add missing tables: SocialProfile, ServiceClient, Prompt
-- Fix Session: replace refreshToken with tokenFamily + tokenHash

-- ── Session fix ────────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS "Session_refreshToken_key";

ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "tokenFamily" TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "tokenHash"   TEXT;

UPDATE "Session"
  SET "tokenFamily" = "id",
      "tokenHash"   = "refreshToken"
  WHERE "tokenFamily" IS NULL;

ALTER TABLE "Session" ALTER COLUMN "tokenFamily" SET NOT NULL;
ALTER TABLE "Session" ALTER COLUMN "tokenHash"   SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX IF NOT EXISTS "Session_userId_idx"      ON "Session"("userId");
CREATE INDEX IF NOT EXISTS "Session_tokenFamily_idx" ON "Session"("tokenFamily");

ALTER TABLE "Session" DROP COLUMN IF EXISTS "refreshToken";

-- ── SocialPlatform enum ────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "SocialPlatform" AS ENUM ('INSTAGRAM', 'TIKTOK', 'YOUTUBE', 'TWITTER', 'LINKEDIN', 'FACEBOOK', 'THREADS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── SocialProfileRole enum ─────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "SocialProfileRole" AS ENUM ('OWNED', 'COMPETITOR', 'INSPIRATION');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── SocialProfile ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "SocialProfile" (
    "id"          TEXT NOT NULL,
    "brandId"     TEXT NOT NULL,
    "platform"    "SocialPlatform" NOT NULL,
    "platformId"  TEXT NOT NULL,
    "handle"      TEXT NOT NULL,
    "displayName" TEXT,
    "role"        "SocialProfileRole" NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SocialProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SocialProfile_brandId_platform_platformId_role_key"
  ON "SocialProfile"("brandId", "platform", "platformId", "role");

ALTER TABLE "SocialProfile"
  ADD CONSTRAINT "SocialProfile_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── ServiceType enum ───────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "ServiceType" AS ENUM ('NAUTHENTICITY', 'FLOWNAU', 'ZAZU');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── ServiceClient ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ServiceClient" (
    "id"          TEXT NOT NULL,
    "service"     "ServiceType" NOT NULL,
    "secretHash"  TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceClient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ServiceClient_service_key" ON "ServiceClient"("service");

-- ── PromptType enum ────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "PromptType" AS ENUM ('SYSTEM', 'USER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── PromptOwnerType enum ───────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "PromptOwnerType" AS ENUM ('WORKSPACE', 'BRAND', 'SOCIAL_PROFILE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Prompt ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Prompt" (
    "id"        TEXT NOT NULL,
    "ownerType" "PromptOwnerType" NOT NULL,
    "ownerId"   TEXT NOT NULL,
    "type"      "PromptType" NOT NULL,
    "body"      TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Prompt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Prompt_ownerType_ownerId_type_key"
  ON "Prompt"("ownerType", "ownerId", "type");

CREATE INDEX IF NOT EXISTS "Prompt_ownerType_ownerId_idx"
  ON "Prompt"("ownerType", "ownerId");

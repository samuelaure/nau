-- CreateTable
CREATE TABLE "YoutubeVideo" (
    "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "brandId"         TEXT NOT NULL,
    "url"             TEXT NOT NULL,
    "videoId"         TEXT NOT NULL,
    "title"           TEXT,
    "channelName"     TEXT,
    "durationSeconds" INTEGER,
    "transcript"      TEXT,
    "synthesis"       TEXT,
    "status"          TEXT NOT NULL DEFAULT 'pending',
    "failureReason"   TEXT,
    "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "YoutubeVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogPost" (
    "id"          TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "brandId"     TEXT NOT NULL,
    "url"         TEXT NOT NULL,
    "title"       TEXT,
    "author"      TEXT,
    "publishedAt" TIMESTAMPTZ,
    "rawText"     TEXT,
    "synthesis"   TEXT,
    "status"      TEXT NOT NULL DEFAULT 'pending',
    "failureReason" TEXT,
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "YoutubeVideo_brandId_videoId_key" ON "YoutubeVideo"("brandId", "videoId");
CREATE INDEX "YoutubeVideo_brandId_status_idx" ON "YoutubeVideo"("brandId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BlogPost_brandId_url_key" ON "BlogPost"("brandId", "url");
CREATE INDEX "BlogPost_brandId_status_idx" ON "BlogPost"("brandId", "status");

-- AddForeignKey
ALTER TABLE "YoutubeVideo" ADD CONSTRAINT "YoutubeVideo_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: add youtubeVideoId + blogPostId to CategoryMembership
ALTER TABLE "CategoryMembership"
  ADD COLUMN "youtubeVideoId" TEXT,
  ADD COLUMN "blogPostId"     TEXT;

ALTER TABLE "CategoryMembership"
  ADD CONSTRAINT "CategoryMembership_youtubeVideoId_fkey"
    FOREIGN KEY ("youtubeVideoId") REFERENCES "YoutubeVideo"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CategoryMembership_blogPostId_fkey"
    FOREIGN KEY ("blogPostId") REFERENCES "BlogPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: add youtubeVideoId + blogPostId to TrashItem
ALTER TABLE "TrashItem"
  ADD COLUMN "youtubeVideoId" TEXT,
  ADD COLUMN "blogPostId"     TEXT;

ALTER TABLE "TrashItem"
  ADD CONSTRAINT "TrashItem_youtubeVideoId_fkey"
    FOREIGN KEY ("youtubeVideoId") REFERENCES "YoutubeVideo"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "TrashItem_blogPostId_fkey"
    FOREIGN KEY ("blogPostId") REFERENCES "BlogPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: add youtubeDurationExceededCount to Brand
ALTER TABLE "Brand"
  ADD COLUMN "youtubeDurationExceededCount" INTEGER NOT NULL DEFAULT 0;

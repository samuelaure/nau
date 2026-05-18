ALTER TABLE "SourceConceptSource"
  ADD COLUMN "voicenoteId" TEXT,
  ADD COLUMN "youtubeVideoId" TEXT,
  ADD COLUMN "blogPostId" TEXT;

ALTER TABLE "SourceConceptSource"
  ADD CONSTRAINT "SourceConceptSource_voicenoteId_fkey" FOREIGN KEY ("voicenoteId") REFERENCES "Voicenote"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "SourceConceptSource_youtubeVideoId_fkey" FOREIGN KEY ("youtubeVideoId") REFERENCES "YoutubeVideo"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "SourceConceptSource_blogPostId_fkey" FOREIGN KEY ("blogPostId") REFERENCES "BlogPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "SourceConceptSource_voicenoteId_idx" ON "SourceConceptSource"("voicenoteId");
CREATE INDEX "SourceConceptSource_youtubeVideoId_idx" ON "SourceConceptSource"("youtubeVideoId");
CREATE INDEX "SourceConceptSource_blogPostId_idx" ON "SourceConceptSource"("blogPostId");

-- Video files are deleted from R2 once ingestion has produced a transcript and
-- a post synthesis: at that point the bytes carry no information the platform
-- does not already hold, and they were 93% of nauthenticity's storage footprint.
--
-- The row stays, the thumbnail stays, and storageUrl becomes NULL to mean "no
-- stored file" rather than pointing at an object that no longer exists.
ALTER TABLE "Media" ALTER COLUMN "storageUrl" DROP NOT NULL;

-- Release the URLs of files already removed from the bucket.
UPDATE "Media" m
SET "storageUrl" = NULL
FROM "Post" p
WHERE p.id = m."postId"
  AND m.type = 'video'
  AND m."storageUrl" LIKE '%.mp4'
  AND p."postSynthesis" IS NOT NULL
  AND m."thumbnailUrl" IS NOT NULL;

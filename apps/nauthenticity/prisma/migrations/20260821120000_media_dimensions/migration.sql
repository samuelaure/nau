-- Native pixel dimensions for a Media item, captured at scrape time.
-- Added for the naŭ mobile reprocessing pipeline: mobile needs width/height
-- up front so it can size a player without probing the file or guessing an
-- aspect ratio. Nullable — backfilled only going forward, existing rows keep NULL.
ALTER TABLE "Media" ADD COLUMN "width" INTEGER;
ALTER TABLE "Media" ADD COLUMN "height" INTEGER;

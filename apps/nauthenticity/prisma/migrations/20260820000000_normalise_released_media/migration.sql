-- An earlier cleanup wrote the sentinel string 'DELETED_CLEANUP' into
-- Media.storageUrl to mean "the file is gone", because the column was NOT NULL
-- and had no way to say it otherwise.
--
-- The column is nullable now, so the same fact is expressed two different ways:
-- NULL for rows released by the current job, and the sentinel for older ones.
-- Any consumer would have to know both, and would eventually check only one.
UPDATE "Media"
SET "storageUrl" = NULL
WHERE "storageUrl" = 'DELETED_CLEANUP';

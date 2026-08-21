-- audioStorageUrl held a public CDN URL: https://media.9nau.com/production/zazu/voicenotes/...
--
-- Two problems in one field. The audio lived in nau-storage, which has
-- media.9nau.com bound to it and is therefore public in its entirety — every
-- personal voice note was downloadable by anyone with the path, and the path
-- contains the Telegram id rather than being fully random.
--
-- And storing a URL rather than a key bakes the delivery mechanism into the
-- data. A key can be served however is appropriate later — a presigned link,
-- a proxy, a public URL — without rewriting rows.
--
-- The objects have been copied to the private bucket nau-private and verified
-- with rclone check at 0 differences. This rewrites the references to keys
-- relative to that bucket, before the public copies are purged.

UPDATE "Voicenote"
SET "audioStorageUrl" = regexp_replace(
      "audioStorageUrl",
      '^https://media\.9nau\.com/production/',
      ''
    )
WHERE "audioStorageUrl" LIKE 'https://media.9nau.com/production/%';

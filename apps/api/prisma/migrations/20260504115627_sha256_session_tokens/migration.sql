-- Switching session tokenHash from bcrypt to SHA-256.
-- Existing sessions stored bcrypt hashes which are incompatible with the new
-- direct-lookup scheme. Clear them so users re-authenticate once after deploy.
DELETE FROM "Session";

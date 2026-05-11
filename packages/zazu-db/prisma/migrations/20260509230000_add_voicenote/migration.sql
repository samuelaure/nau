CREATE TABLE "Voicenote" (
  "id"                 TEXT NOT NULL,
  "userId"             TEXT NOT NULL,
  "audioStorageUrl"    TEXT NOT NULL,
  "rawTranscription"   TEXT NOT NULL,
  "cleanTranscription" TEXT NOT NULL,
  "synthesis"          TEXT NOT NULL,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Voicenote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Voicenote_userId_idx" ON "Voicenote"("userId");

ALTER TABLE "Voicenote" ADD CONSTRAINT "Voicenote_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

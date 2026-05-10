CREATE TABLE "Voicenote" (
  "id"                 TEXT NOT NULL,
  "brandId"            TEXT NOT NULL,
  "cleanTranscription" TEXT NOT NULL,
  "synthesis"          TEXT NOT NULL,
  "sourceRef"          TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Voicenote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Voicenote_brandId_idx" ON "Voicenote"("brandId");

ALTER TABLE "Voicenote" ADD CONSTRAINT "Voicenote_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

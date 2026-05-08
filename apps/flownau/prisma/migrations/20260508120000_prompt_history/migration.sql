CREATE TABLE "PromptHistory" (
    "id"          TEXT NOT NULL,
    "entityType"  TEXT NOT NULL,
    "entityId"    TEXT NOT NULL,
    "field"       TEXT NOT NULL,
    "content"     TEXT NOT NULL,
    "activeSince" TIMESTAMP(3) NOT NULL,
    "replacedAt"  TIMESTAMP(3),
    CONSTRAINT "PromptHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PromptHistory_entityType_entityId_field_idx"
    ON "PromptHistory"("entityType", "entityId", "field");

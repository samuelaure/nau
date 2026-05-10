-- Add Project table (mirror of api's Project)
CREATE TABLE "Project" (
  "id"          TEXT        NOT NULL,
  "workspaceId" TEXT        NOT NULL,
  "brandId"     TEXT,
  "name"        TEXT        NOT NULL,
  "isActive"    BOOLEAN     NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Project_workspaceId_idx" ON "Project"("workspaceId");

-- Extend CategoryMembership: brandId becomes nullable, projectId added
ALTER TABLE "CategoryMembership" ALTER COLUMN "brandId" DROP NOT NULL;
ALTER TABLE "CategoryMembership" ADD COLUMN "projectId" TEXT REFERENCES "Project"("id") ON DELETE CASCADE;

-- Exactly one of brandId / projectId must be set
ALTER TABLE "CategoryMembership" ADD CONSTRAINT "membership_owner_check"
  CHECK (("brandId" IS NOT NULL) <> ("projectId" IS NOT NULL));

CREATE INDEX "CategoryMembership_projectId_idx" ON "CategoryMembership"("projectId");

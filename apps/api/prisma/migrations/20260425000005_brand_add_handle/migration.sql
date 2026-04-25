-- Add missing handle column to Brand and its unique index
ALTER TABLE "Brand" ADD COLUMN "handle" TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX "Brand_workspaceId_handle_key" ON "Brand"("workspaceId", "handle");

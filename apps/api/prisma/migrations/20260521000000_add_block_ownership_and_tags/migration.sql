-- DropIndex
DROP INDEX "SyncCursor_userId_key";

-- AlterTable
ALTER TABLE "Block" ADD COLUMN     "userId" TEXT,
ADD COLUMN     "workspaceId" TEXT;

-- AlterTable
ALTER TABLE "SyncCursor" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockTag" (
    "blockId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "BlockTag_pkey" PRIMARY KEY ("blockId","tagId")
);

-- CreateIndex
CREATE INDEX "Tag_workspaceId_idx" ON "Tag"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_workspaceId_name_key" ON "Tag"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "Block_workspaceId_idx" ON "Block"("workspaceId");

-- CreateIndex
CREATE INDEX "Block_userId_idx" ON "Block"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncCursor_userId_workspaceId_key" ON "SyncCursor"("userId", "workspaceId");

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Tag"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockTag" ADD CONSTRAINT "BlockTag_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockTag" ADD CONSTRAINT "BlockTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Remove default after migration (workspaceId will be set properly in Phase 3)
ALTER TABLE "SyncCursor" ALTER COLUMN "workspaceId" DROP DEFAULT;

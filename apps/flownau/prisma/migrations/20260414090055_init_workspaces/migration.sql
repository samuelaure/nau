-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceUser" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'owner',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceUser_userId_workspaceId_key" ON "WorkspaceUser"("userId", "workspaceId");

-- AddForeignKey
ALTER TABLE "WorkspaceUser" ADD CONSTRAINT "WorkspaceUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceUser" ADD CONSTRAINT "WorkspaceUser_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 1: Add workspaceId column to SocialAccount as nullable first
ALTER TABLE "SocialAccount" ADD COLUMN "workspaceId" TEXT;

-- Step 2: Data Migration
-- 2.1 Create a workspace for every user that didn't have one (though it works for all since it's a new table)
-- We use a prefix 'ws_' + userId to ensure uniqueness or just let it generate. 
-- Since it's SQL, we'll use 'w_' || id.
INSERT INTO "Workspace" ("id", "name", "updatedAt")
SELECT 'w_' || "id", COALESCE("name", 'User') || '''s Workspace', NOW()
FROM "User";

-- 2.2 Link users to their new workspaces
INSERT INTO "WorkspaceUser" ("id", "userId", "workspaceId", "role", "updatedAt")
SELECT 'wu_' || "id", "id", 'w_' || "id", 'owner', NOW()
FROM "User";

-- 2.3 Update SocialAccount to point to the new workspaceId based on the old userId
UPDATE "SocialAccount"
SET "workspaceId" = 'w_' || "userId";

-- Step 3: Cleanup and Constraints
-- 3.1 Drop the foreign key constraint on userId
ALTER TABLE "SocialAccount" DROP CONSTRAINT "SocialAccount_userId_fkey";

-- 3.2 Make workspaceId NOT NULL
ALTER TABLE "SocialAccount" ALTER COLUMN "workspaceId" SET NOT NULL;

-- 3.3 Drop userId column
ALTER TABLE "SocialAccount" DROP COLUMN "userId";

-- 3.4 Add foreign key constraint for workspaceId
ALTER TABLE "SocialAccount" ADD CONSTRAINT "SocialAccount_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

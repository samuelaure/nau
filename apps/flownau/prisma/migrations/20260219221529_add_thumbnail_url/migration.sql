-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "thumbnailUrl" TEXT;

-- AlterTable
ALTER TABLE "SocialAccount" ADD COLUMN     "assetsRoot" TEXT;

-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "assetsRoot" TEXT;

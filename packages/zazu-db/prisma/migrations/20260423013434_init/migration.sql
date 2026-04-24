-- CreateEnum
CREATE TYPE "OnboardingState" AS ENUM ('AWAITING_NAME', 'COMPLETED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "username" TEXT,
    "displayName" TEXT,
    "onboardingState" "OnboardingState" NOT NULL DEFAULT 'AWAITING_NAME',
    "nauUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feature" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "Feature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserFeature" (
    "userId" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "config" JSONB,

    CONSTRAINT "UserFeature_pkey" PRIMARY KEY ("userId","featureId")
);

-- CreateTable
CREATE TABLE "DeliveryWindow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startHour" INTEGER NOT NULL DEFAULT 9,
    "endHour" INTEGER NOT NULL DEFAULT 18,
    "timeZone" TEXT NOT NULL DEFAULT 'UTC',

    CONSTRAINT "DeliveryWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationQueue" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brandName" TEXT,
    "payloadJson" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "failures" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "NotificationQueue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryWindow_userId_key" ON "DeliveryWindow"("userId");

-- CreateIndex
CREATE INDEX "NotificationQueue_userId_status_idx" ON "NotificationQueue"("userId", "status");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFeature" ADD CONSTRAINT "UserFeature_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFeature" ADD CONSTRAINT "UserFeature_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryWindow" ADD CONSTRAINT "DeliveryWindow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationQueue" ADD CONSTRAINT "NotificationQueue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


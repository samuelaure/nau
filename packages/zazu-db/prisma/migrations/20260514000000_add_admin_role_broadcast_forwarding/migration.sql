ALTER TYPE "Role" ADD VALUE 'ADMIN';

ALTER TABLE "User" ADD COLUMN "forwardNotificationsToAdmin" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "Broadcast" (
  "id"        TEXT NOT NULL,
  "message"   TEXT NOT NULL,
  "sentCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Broadcast_pkey" PRIMARY KEY ("id")
);

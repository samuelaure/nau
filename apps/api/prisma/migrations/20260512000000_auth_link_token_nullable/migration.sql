-- Make userId nullable and add telegramId to AuthLinkToken (supports bot-initiated linking flow)
ALTER TABLE "AuthLinkToken" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "AuthLinkToken" ADD COLUMN "telegramId" TEXT;

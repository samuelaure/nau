'use server';

import { jwtVerify } from "jose";
import prisma from "@zazu/db";
import { auth } from "../../auth";

const JWT_SECRET = process.env.JWT_SECRET ?? "changeme";
const NAU_API_URL = process.env.NAU_API_URL ?? "https://api.9nau.com";
const NAU_SERVICE_KEY = process.env.NAU_SERVICE_KEY ?? "";

export async function linkTelegramAccount(jwt: string): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.userId) {
    return { success: false, error: "Not authenticated" };
  }

  const telegramId = session.user.userId;

  let nauUserId: string;
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(jwt, secret);
    if (!payload.sub) return { success: false, error: "Invalid token" };
    nauUserId = payload.sub;
  } catch {
    return { success: false, error: "Invalid or expired token" };
  }

  await prisma.user.update({
    where: { telegramId: BigInt(telegramId) },
    data: { nauUserId },
  });

  try {
    await fetch(`${NAU_API_URL}/api/v1/link-telegram`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${NAU_SERVICE_KEY}`,
      },
      body: JSON.stringify({ nauUserId, telegramId }),
    });
  } catch (e) {
    console.error("Failed to notify 9nau API of telegram link:", e);
  }

  return { success: true };
}

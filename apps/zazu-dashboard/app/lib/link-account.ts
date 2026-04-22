'use server';

import crypto from "crypto";
import { jwtVerify } from "jose";
import prisma from "@zazu/db";
import { auth } from "../../auth";

const AUTH_SECRET = process.env.AUTH_SECRET ?? "changeme";
const NAU_API_URL = process.env.NAU_API_URL ?? "https://api.9nau.com";
const NAU_SERVICE_KEY = process.env.NAU_SERVICE_KEY ?? "";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";

/** Validates Telegram initData and returns the telegramId, or null if invalid. */
function extractTelegramId(initData: string): string | null {
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get("hash");
    if (!hash) return null;
    urlParams.delete("hash");

    const params = Array.from(urlParams.entries())
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join("\n");

    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(TELEGRAM_BOT_TOKEN)
      .digest();

    const expected = crypto
      .createHmac("sha256", secretKey)
      .update(params)
      .digest("hex");

    if (expected !== hash) return null;

    const userStr = urlParams.get("user");
    if (!userStr) return null;
    const tgUser = JSON.parse(userStr);
    return tgUser.id?.toString() ?? null;
  } catch {
    return null;
  }
}

/**
 * Links a naŭ Account (identified by the 9nau JWT) to the current Zazu user.
 *
 * Resolves the Telegram user in order of preference:
 *  1. Active NextAuth session (cookie still alive after redirect)
 *  2. Telegram initData re-validated against the bot token (fallback for when
 *     the WebView drops the cookie during cross-domain navigation)
 */
export async function linkTelegramAccount(
  jwt: string,
  initData?: string,
): Promise<{ success: boolean; error?: string }> {
  // 1. Try initData first (direct Telegram identity)
  if (initData) {
    telegramId = extractTelegramId(initData);
  }

  // 2. Fall back to existing session if no initData or initData invalid
  if (!telegramId) {
    const session = await auth();
    const userId = session?.user?.userId;
    // Only use session ID if it looks like a Telegram ID (numeric)
    if (userId && /^\d+$/.test(userId)) {
      telegramId = userId;
    }
  }

  if (!telegramId) {
    return { success: false, error: "No se pudo identificar tu cuenta de Telegram. Por favor, abre Zazŭ desde Telegram." };
  }

  // 3. Verify the naŭ JWT and extract nauUserId
  let nauUserId: string;
  try {
    const secret = new TextEncoder().encode(AUTH_SECRET);
    const { payload } = await jwtVerify(jwt, secret);
    if (!payload.sub) return { success: false, error: "Invalid token" };
    nauUserId = payload.sub;
  } catch {
    return { success: false, error: "Invalid or expired token" };
  }

  // 4. Update Zazu DB
  await prisma.user.update({
    where: { telegramId: BigInt(telegramId) },
    data: { nauUserId },
  });

  // 5. Notify 9nau API (best-effort)
  try {
    await fetch(`${NAU_API_URL}/api/auth/link-telegram`, {
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

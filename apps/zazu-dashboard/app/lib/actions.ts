'use server';

import prisma, { OnboardingState, Role } from '@zazu/db';
import { revalidatePath } from 'next/cache';

/**
 * Fetch all users from the database
 */
export async function getUsers() {
  try {
    return await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
}

/**
 * Fetch full chat history for a specific user
 */
export async function getChatHistory(userId: string) {
  try {
    return await prisma.message.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    return [];
  }
}

/**
 * Send a message as Zazu (Assistant) through the Telegram API and save to DB
 */
export async function sendMessageAsZazu(userId: string, telegramId: string, content: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('Bot token not configured');

  try {
    // 1. Send via Telegram Bot API
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramId,
        text: content,
      }),
    });

    const result = await response.json();
    if (!result.ok) throw new Error(result.description || 'Failed to send Telegram message');

    // 2. Save to database
    await prisma.message.create({
      data: {
        userId,
        role: Role.ASSISTANT,
        content,
        metadata: { source: 'dashboard', telegramId: result.result.message_id },
      },
    });

    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error('Error sending message:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update user features (json field in Prisma)
 */
export async function toggleUserFeature(userId: string, features: string[]) {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { features },
    });
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Error toggling feature:', error);
    return { success: false };
  }
}

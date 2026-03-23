'use server';

import prisma, { OnboardingState, Role } from '@zazu/db';
import { revalidatePath } from 'next/cache';

/**
 * Fetch all users from the database with their last message and active features
 */
export async function getUsers() {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        features: {
          select: {
            featureId: true
          }
        }
      }
    });

    // Transform to simplify frontend usage (BigInt to string, features as string[])
    return users.map(user => ({
      ...user,
      telegramId: user.telegramId.toString(),
      features: user.features.map(f => f.featureId)
    }));
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
 * Toggle a specific feature for a user
 */
export async function toggleUserFeature(userId: string, featureId: string, active: boolean) {
  try {
    if (active) {
      // Connect/Create relation
      await prisma.userFeature.upsert({
        where: {
          userId_featureId: {
            userId,
            featureId
          }
        },
        create: {
          userId,
          featureId
        },
        update: {} // No changes needed if it exists
      });
    } else {
      // Disconnect
      await prisma.userFeature.deleteMany({
        where: { userId, featureId }
      });
    }
    
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Error toggling feature:', error);
    return { success: false };
  }
}

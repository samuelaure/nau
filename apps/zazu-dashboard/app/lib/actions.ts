'use server';

import prisma, { OnboardingState, Role } from '@zazu/db';
import { revalidatePath } from 'next/cache';
import { auth } from '../../auth';

/**
 * Fetch all users from the database with their last message and active features
 */
export async function getUsers() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return [];
  }

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
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return [];
  }

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
  const session = await auth();
  if (!session?.user?.isAdmin) return { success: false, error: 'Unauthorized' };

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
  } catch (error: unknown) {
    console.error('Error sending message:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Send a broadcast message to ALL normal users from Zazŭ
 */
export async function sendBroadcast(content: string) {
  const session = await auth();
  if (!session?.user?.isAdmin) return { success: false, error: 'Unauthorized' };

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { success: false, error: 'Bot token not configured' };

  try {
    const users = await prisma.user.findMany({ select: { telegramId: true } });
    
    // Fire and forget requests in parallel
    const promises = users.map(user => 
      fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: user.telegramId.toString(),
          text: content,
        }),
      }).catch(e => console.error(`Broadcast failed for ${user.telegramId}`, e))
    );

    await Promise.allSettled(promises);
    return { success: true };
  } catch (error: Error | unknown) {
    console.error('Error sending broadcast:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Toggle a specific feature for a user
 */
export async function toggleUserFeature(userId: string, featureId: string, active: boolean) {
  const session = await auth();
  if (!session?.user?.isAdmin) return { success: false, error: 'Unauthorized' };

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

/**
 * Fetch all brands and targets for the admin user from nauthenticity
 */
export async function getBrands() {
  const url = process.env.NAUTHENTICITY_URL || 'http://localhost:3000';
  const key = process.env.NAU_SERVICE_KEY;
  // Temporary: we assume a fixed admin user ID for the dashboard
  const userId = 'admin'; 

  try {
    const res = await fetch(`${url}/v1/brands?userId=${userId}`, {
      headers: { Authorization: `Bearer ${key}` },
      next: { tags: ['brands'], revalidate: 0 }
    });
    if (!res.ok) throw new Error('Failed to fetch brands');
    const brands = await res.json();
    return brands;
  } catch (error) {
    console.error('Error fetching brands:', error);
    return [];
  }
}

/**
 * Create or update a brand config
 */
export async function upsertBrand(payload: any) {
  const url = process.env.NAUTHENTICITY_URL || 'http://localhost:3000';
  const key = process.env.NAU_SERVICE_KEY;
  const userId = 'admin';

  try {
    const res = await fetch(`${url}/v1/brands`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}` 
      },
      body: JSON.stringify({ ...payload, userId })
    });
    if (!res.ok) throw new Error('Failed to upsert brand');
    
    revalidatePath('/brands');
    return { success: true, data: await res.json() };
  } catch (error: any) {
    console.error('Error upserting brand:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Add target usernames to monitor for a brand
 */
export async function addBrandTargets(brandId: string, usernames: string[]) {
  const url = process.env.NAUTHENTICITY_URL || 'http://localhost:3000';
  const key = process.env.NAU_SERVICE_KEY;

  try {
    const res = await fetch(`${url}/v1/targets`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}` 
      },
      body: JSON.stringify({ brandId, usernames })
    });
    if (!res.ok) throw new Error('Failed to add brand targets');
    
    revalidatePath('/brands');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Remove a specific target from a brand
 */
export async function removeBrandTarget(brandId: string, username: string) {
  const url = process.env.NAUTHENTICITY_URL || 'http://localhost:3000';
  const key = process.env.NAU_SERVICE_KEY;

  try {
    const res = await fetch(`${url}/v1/targets?brandId=${brandId}&username=${username}`, {
      method: 'DELETE',
      headers: { 
        Authorization: `Bearer ${key}` 
      }
    });
    if (!res.ok) throw new Error('Failed to remove brand target');
    
    revalidatePath('/brands');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

'use server';

import prisma, { Role } from '@zazu/db';
import { revalidatePath } from 'next/cache';
import { auth } from '../../auth';
import { signServiceToken } from '@nau/auth';

async function serviceHeaders(target: string): Promise<Record<string, string>> {
  const secret = process.env.AUTH_SECRET ?? '';
  const token = await signServiceToken({ iss: 'zazu-dashboard', aud: target, secret });
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

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

// ---------------------------------------------------------------------------
// Nauthenticity API helpers
// ---------------------------------------------------------------------------

const getNautUrl = () => process.env.NAUTHENTICITY_URL || 'http://nauthenticity:4000';
const getNautHeaders = () => serviceHeaders('nauthenticity');

// ---------------------------------------------------------------------------
// Brand types
// ---------------------------------------------------------------------------

export interface BrandTarget {
  username: string;
  profileStrategy: string | null;
}

export interface Brand {
  id: string;
  brandId?: string; // BrandIntelligence uses brandId as PK
  userId?: string;
  brandName?: string;
  name?: string; // 9naŭ Brand.name
  voicePrompt?: string;
  commentStrategy?: string | null;
  suggestionsCount?: number;
  windowStart?: string | null;
  windowEnd?: string | null;
  timezone?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  targets?: BrandTarget[];
  workspaceId?: string;
}

export interface NauWorkspace {
  id: string;
  name: string;
  role: string;
  brands: { id: string; name: string; timezone: string }[];
}

export interface BrandCreatePayload {
  brandName: string;
  voicePrompt?: string;
  commentStrategy?: string | null;
  suggestionsCount?: number;
  windowStart?: string | null;
  windowEnd?: string | null;
  timezone?: string;
  isActive?: boolean;
}

export type BrandUpdatePayload = Partial<BrandCreatePayload>;

// ---------------------------------------------------------------------------
// Brand actions
// ---------------------------------------------------------------------------

/**
 * Fetch all workspaces (with brands) for the current user from 9naŭ API.
 */
export async function getWorkspaces(): Promise<NauWorkspace[]> {
  const nauApiUrl = process.env.NAU_API_URL ?? 'http://9nau-api:3000';

  const session = await auth();
  if (!session?.user) return [];

  // The JWT caches nauUserId at login time and only refreshes on explicit session.update().
  // Re-read from DB to guarantee freshness — covers users who linked after logging in.
  let nauUserId = session.user.nauUserId;

  if (!nauUserId) {
    const telegramId = session.user.userId;
    if (telegramId && /^\d+$/.test(telegramId)) {
      // Telegram login: look up the linked 9nau account from the Zazu DB
      const dbUser = await prisma.user.findUnique({
        where: { telegramId: BigInt(telegramId) },
        select: { nauUserId: true },
      });
      nauUserId = dbUser?.nauUserId ?? null;
    } else if (telegramId) {
      // nau-sso login: userId IS the nauUserId (CUID)
      nauUserId = telegramId;
    }
  }

  if (!nauUserId) return [];

  try {
    const headers = await serviceHeaders('9nau-api');
    const res = await fetch(`${nauApiUrl}/_service/workspaces/user/${nauUserId}`, {
      headers,
      next: { revalidate: 0 },
    });
    if (!res.ok) return [];
    return (await res.json()) as NauWorkspace[];
  } catch {
    return [];
  }
}

/**
 * Fetch all brands for the current user.
 * Merges structural data (9naŭ) with intelligence DNA (Nauthenticity).
 */
export async function getBrands(): Promise<Brand[]> {
  const workspaces = await getWorkspaces();
  const nautUrl = getNautUrl();
  const nautHeaders = await getNautHeaders();

  const allBrands: Brand[] = [];

  for (const ws of workspaces) {
    try {
      // Fetch intelligence for all brands in this workspace from Nauthenticity
      const intelligenceRes = await fetch(`${nautUrl}/api/service/brands?workspaceId=${ws.id}`, {
        headers: nautHeaders,
      });
      const intelligence = intelligenceRes.ok ? await intelligenceRes.json() : [];

      for (const b of ws.brands) {
        const intel = intelligence.find((i: any) => i.brandId === b.id);
        allBrands.push({
          id: b.id,
          brandId: b.id,
          workspaceId: ws.id,
          name: b.name,
          brandName: b.name,
          timezone: b.timezone ?? 'UTC',
          voicePrompt: intel?.voicePrompt ?? '',
          commentStrategy: intel?.commentStrategy ?? '',
          suggestionsCount: intel?.suggestionsCount ?? 3,
          windowStart: intel?.windowStart ?? null,
          windowEnd: intel?.windowEnd ?? null,
          targets: intel?.targets ?? [],
          isActive: true,
        });
      }
    } catch (e) {
      console.error(`Failed to fetch intelligence for workspace ${ws.id}`, e);
      // Fallback to just structural data
      for (const b of ws.brands) {
        allBrands.push({ id: b.id, name: b.name, timezone: b.timezone });
      }
    }
  }

  return allBrands;
}

/**
 * Create a new brand.
 * 1. Create structural record in 9naŭ.
 * 2. Create intelligence record in Nauthenticity.
 */
export async function createBrand(payload: BrandCreatePayload & { workspaceId: string }): Promise<{ success: boolean; data?: Brand; error?: string }> {
  const nauApiUrl = process.env.NAU_API_URL ?? 'http://9nau-api:3000';

  try {
    const nauHeaders = await serviceHeaders('9nau-api');
    // 1. Create in 9naŭ
    const res9 = await fetch(`${nauApiUrl}/_service/workspaces/${payload.workspaceId}/brands`, {
      method: 'POST',
      headers: nauHeaders,
      body: JSON.stringify({ name: payload.brandName, timezone: payload.timezone }),
    });
    if (!res9.ok) throw new Error(await res9.text());
    const brand9 = await res9.json() as { id: string; name: string };

    // 2. Initialize voice synthesis in Nauthenticity (optional)
    if (payload.voicePrompt) {
      const nautHeaders = await getNautHeaders();
      await fetch(`${getNautUrl()}/api/v1/_service/brands/${brand9.id}/synthesis`, {
        method: 'POST',
        headers: nautHeaders,
        body: JSON.stringify({ type: 'voice', content: payload.voicePrompt }),
      }).catch(() => undefined);
    }
    const resN = { ok: true };
    if (!resN.ok) throw new Error(await resN.text());

    revalidatePath('/brands');
    return { success: true, data: { ...brand9, brandName: brand9.name } };
  } catch (error: unknown) {
    console.error('[actions] createBrand error:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Update an existing brand.
 * Updates both 9naŭ (structural) and Nauthenticity (intelligence).
 */
export async function updateBrand(brandId: string, payload: BrandUpdatePayload & { workspaceId?: string }): Promise<{ success: boolean; data?: Brand; error?: string }> {
  const nauApiUrl = process.env.NAU_API_URL ?? 'http://9nau-api:3000';

  try {
    // 1. Update 9naŭ if name/timezone changed and workspaceId is known
    if (payload.workspaceId && (payload.brandName || payload.timezone)) {
      const nauHeaders = await serviceHeaders('9nau-api');
      await fetch(`${nauApiUrl}/_service/workspaces/${payload.workspaceId}/brands/${encodeURIComponent(brandId)}`, {
        method: 'PATCH',
        headers: nauHeaders,
        body: JSON.stringify({ name: payload.brandName, timezone: payload.timezone }),
      });
    }

    // 2. Update intelligence in Nauthenticity
    const nautHeaders = await getNautHeaders();
    const res = await fetch(`${getNautUrl()}/api/v1/brands/${encodeURIComponent(brandId)}/synthesis`, {
      method: 'PUT',
      headers: nautHeaders,
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    
    revalidatePath('/brands');
    return { success: true, data: (await res.json()) as Brand };
  } catch (error: unknown) {
    console.error('[actions] updateBrand error:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Delete a brand.
 */
export async function deleteBrand(brandId: string, workspaceId: string): Promise<{ success: boolean; error?: string }> {
  const nauApiUrl = process.env.NAU_API_URL ?? 'http://9nau-api:3000';

  try {
    const nauHeaders = await serviceHeaders('9nau-api');
    // Structural delete in 9naŭ
    const res = await fetch(`${nauApiUrl}/_service/workspaces/${workspaceId}/brands/${encodeURIComponent(brandId)}`, {
      method: 'DELETE',
      headers: nauHeaders,
    });
    
    if (!res.ok) throw new Error(await res.text());
    revalidatePath('/brands');
    return { success: true };
  } catch (error: unknown) {
    console.error('[actions] deleteBrand error:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Deactivate ALL brands for a user (called when Comment Suggester feature is disabled).
 */
export async function deactivateBrandsForUser(userId: string): Promise<{ success: boolean; error?: string }> {
  const brands = await getBrands();
  const userBrands = brands.filter(b => b.userId === userId);

  const results = await Promise.allSettled(
    userBrands.map(b => updateBrand(b.id, { isActive: false })),
  );

  const failed = results.filter(r => r.status === 'rejected');
  if (failed.length > 0) {
    return { success: false, error: `${failed.length} brand(s) failed to deactivate` };
  }
  return { success: true };
}

// ---------------------------------------------------------------------------
// Target (monitored profile) actions
// ---------------------------------------------------------------------------

export interface TargetAddPayload {
  brandId: string;
  usernames: string[];
  profileStrategy?: string | null;
}

/**
 * Add one or more monitored profiles to a brand, with optional profile strategy.
 */
export async function addBrandTargets(payload: TargetAddPayload): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${getNautUrl()}/api/targets`, {
      method: 'POST',
      headers: await getNautHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    revalidatePath('/brands');
    return { success: true };
  } catch (error: unknown) {
    console.error('[actions] addBrandTargets error:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Update the profile strategy for a specific target.
 */
export async function updateBrandTarget(
  brandId: string,
  username: string,
  profileStrategy: string | null,
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(
      `${getNautUrl()}/api/targets/${encodeURIComponent(brandId)}/${encodeURIComponent(username)}`,
      {
        method: 'PUT',
        headers: await getNautHeaders(),
        body: JSON.stringify({ profileStrategy }),
      },
    );
    if (!res.ok) throw new Error(await res.text());
    revalidatePath('/brands');
    return { success: true };
  } catch (error: unknown) {
    console.error('[actions] updateBrandTarget error:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Remove a specific monitored profile from a brand.
 */
export async function removeBrandTarget(brandId: string, username: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(
      `${getNautUrl()}/api/targets?brandId=${encodeURIComponent(brandId)}&username=${encodeURIComponent(username)}`,
      { method: 'DELETE', headers: await getNautHeaders() },
    );
    if (!res.ok) throw new Error(await res.text());
    revalidatePath('/brands');
    return { success: true };
  } catch (error: unknown) {
    console.error('[actions] removeBrandTarget error:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// ---------------------------------------------------------------------------
// Comment Feedback action
// ---------------------------------------------------------------------------

export interface CommentFeedbackPayload {
  commentText: string;
  brandId: string;
  sourcePostId: string;
  isSelected: boolean;
}

/**
 * Submit comment feedback to nauthenticity.
 * isSelected=true: the user confirmed this suggestion as their preferred one.
 * isSelected=false: optimistic dedup record (sent by fanout, not by user).
 */
export async function submitCommentFeedback(payload: CommentFeedbackPayload): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${getNautUrl()}/api/comment-feedback`, {
      method: 'POST',
      headers: await getNautHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    return { success: true };
  } catch (error: unknown) {
    console.error('[actions] submitCommentFeedback error:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

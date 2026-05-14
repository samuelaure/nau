import { prisma } from '@/modules/shared/prisma'
import { acquireLock } from '@/modules/shared/rate-limit'
import { logger, logError } from '@/modules/shared/logger'
import { signServiceToken } from '@nau/auth'

const ZAZU_URL = () => process.env.ZAZU_INTERNAL_URL || 'http://zazu:3000'
const API_URL = () => process.env.NAU_API_URL || 'http://api:3000'

async function resolveNauUserIds(workspaceId: string): Promise<string[]> {
  const secret = process.env.AUTH_SECRET
  if (!secret) return []
  try {
    const token = await signServiceToken({ iss: 'flownau', aud: '9nau-api', secret })
    const res = await fetch(`${API_URL()}/workspaces/_service/${workspaceId}/notification-target`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return []
    const body = (await res.json()) as { nauUserIds: string[] }
    return body.nauUserIds ?? []
  } catch {
    return []
  }
}

async function sendZazuNotification(nauUserId: string, type: string, payload: Record<string, unknown>): Promise<void> {
  const secret = process.env.AUTH_SECRET
  if (!secret) return
  const token = await signServiceToken({ iss: 'flownau', aud: 'zazu', secret })
  await fetch(`${ZAZU_URL()}/api/internal/notify`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ nauUserId, type, ...payload }),
  })
}

async function notifyAllMembers(workspaceId: string, type: string, payload: Record<string, unknown>): Promise<void> {
  const userIds = await resolveNauUserIds(workspaceId)
  if (!userIds.length) {
    logger.warn({ workspaceId }, '[ApprovalNotif] Could not resolve any nauUserIds')
    return
  }
  await Promise.all(userIds.map(id => sendZazuNotification(id, type, payload).catch(err => logError('[ApprovalNotif] Failed to send notification', err))))
}

function calendarUrl(workspaceId: string, brandId: string): string {
  const base = process.env.NEXT_PUBLIC_FLOWNAU_URL || 'https://flow.9nau.com'
  return `${base}/dashboard/workspace/${workspaceId}?brandId=${brandId}&tab=calendar`
}

function postUrl(workspaceId: string, postId: string): string {
  const base = process.env.NEXT_PUBLIC_FLOWNAU_URL || 'https://flow.9nau.com'
  return `${base}/dashboard/workspace/${workspaceId}/draft/${postId}`
}

// ─── Today digest ─────────────────────────────────────────────────────────────
// Call every 5 min; fires once per brand per day (90 min before first post of day).
export async function notifyTodayDigest(brandId: string): Promise<void> {
  const now = new Date()
  const startOfDay = new Date(now)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(now)
  endOfDay.setHours(23, 59, 59, 999)

  const firstPost = await prisma.post.findFirst({
    where: {
      brandId,
      scheduledAt: { gte: startOfDay, lte: endOfDay },
      status: { not: 'PUBLISHED' },
    },
    orderBy: { scheduledAt: 'asc' },
    select: { scheduledAt: true },
  })

  if (!firstPost?.scheduledAt) return

  const msUntilFirst = firstPost.scheduledAt.getTime() - now.getTime()
  const ninetyMin = 90 * 60 * 1000
  // Only fire within the 90-minute window before first post, not earlier
  if (msUntilFirst > ninetyMin || msUntilFirst < 0) return

  const dedupKey = `notif:today-digest:${brandId}:${startOfDay.toISOString().slice(0, 10)}`
  const acquired = await acquireLock(dedupKey, 24 * 60 * 60 * 1000)
  if (!acquired) return

  const pendingPosts = await prisma.post.findMany({
    where: {
      brandId,
      scheduledAt: { gte: startOfDay, lte: endOfDay },
      status: 'RENDERED_PENDING',
    },
    orderBy: { scheduledAt: 'asc' },
    select: { id: true, scheduledAt: true, brand: { select: { name: true, workspaceId: true } } },
  })

  if (pendingPosts.length === 0) return

  const brand = pendingPosts[0].brand

  const postLines = pendingPosts
    .map((p) => `• [Post ${formatTime(p.scheduledAt!)}](${postUrl(brand.workspaceId, p.id)})`)
    .join('\n')

  const markdown = `📅 *${brand.name} — Today's Posts Need Approval*\n\n${postLines}\n\n[Go to Calendar](${calendarUrl(brand.workspaceId, brandId)})`

  await notifyAllMembers(brand.workspaceId, 'approval_digest_today', {
    brandId,
    brandName: brand.name,
    markdown,
  })
}

// ─── Tomorrow digest ───────────────────────────────────────────────────────────
// Called from post-published after the last post of today is published.
export async function notifyTomorrowDigest(brandId: string): Promise<void> {
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const startOfTomorrow = new Date(tomorrow)
  startOfTomorrow.setHours(0, 0, 0, 0)
  const endOfTomorrow = new Date(tomorrow)
  endOfTomorrow.setHours(23, 59, 59, 999)

  const pendingPosts = await prisma.post.findMany({
    where: {
      brandId,
      scheduledAt: { gte: startOfTomorrow, lte: endOfTomorrow },
      status: 'RENDERED_PENDING',
    },
    orderBy: { scheduledAt: 'asc' },
    select: { id: true, scheduledAt: true, brand: { select: { name: true, workspaceId: true } } },
  })

  if (pendingPosts.length === 0) return

  const brand = pendingPosts[0].brand

  const dedupKey = `notif:tomorrow-digest:${brandId}:${startOfTomorrow.toISOString().slice(0, 10)}`
  const acquired = await acquireLock(dedupKey, 24 * 60 * 60 * 1000)
  if (!acquired) return

  const postLines = pendingPosts
    .map((p) => `• [Post ${formatTime(p.scheduledAt!)}](${postUrl(brand.workspaceId, p.id)})`)
    .join('\n')

  const markdown = `🌅 *${brand.name} — Tomorrow's Posts Need Approval*\n\n${postLines}\n\n[Go to Calendar](${calendarUrl(brand.workspaceId, brandId)})`

  await notifyAllMembers(brand.workspaceId, 'approval_digest_tomorrow', {
    brandId,
    brandName: brand.name,
    markdown,
  })
}

// ─── Next-in-line urgent ───────────────────────────────────────────────────────
// Call every 5 min; fires once per post (deduped by postId).
export async function notifyNextInLine(brandId: string): Promise<void> {
  const now = new Date()
  const thirtyMin = new Date(now.getTime() + 30 * 60 * 1000)

  const post = await prisma.post.findFirst({
    where: {
      brandId,
      scheduledAt: { lte: thirtyMin, gte: now },
      status: { in: ['RENDERED_PENDING', 'DRAFT_PENDING'] },
    },
    orderBy: { scheduledAt: 'asc' },
    select: { id: true, scheduledAt: true, brand: { select: { name: true, workspaceId: true } } },
  })

  if (!post) return

  const dedupKey = `notif:next-in-line:${post.id}`
  const acquired = await acquireLock(dedupKey, 2 * 60 * 60 * 1000)
  if (!acquired) return

  const brand = post.brand
  const markdown = `⚠️ *${brand.name} — Post needs urgent approval*\n\nScheduled at *${formatTime(post.scheduledAt!)}* and still pending your review.\n\n[Approve Now](${postUrl(brand.workspaceId, post.id)}) · [Calendar](${calendarUrl(brand.workspaceId, brandId)})`

  await notifyAllMembers(brand.workspaceId, 'approval_next_in_line', {
    brandId,
    brandName: brand.name,
    postId: post.id,
    markdown,
  }).catch((err) => logError('[ApprovalNotif] Failed to send next-in-line notification', err))
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }) + ' UTC'
}

import { prisma } from '@/modules/shared/prisma'
import type { Prisma } from '@prisma/client'
import crypto from 'crypto'

// ─── Head Talk Detection ───────────────────────────────────────────

const HEAD_TALK_KEYWORDS = [
  'react',
  'response',
  'opinion',
  'explain',
  'story time',
  'hot take',
  'my take',
  'unpopular opinion',
  'react to',
  'reacciona',
  'opinión',
  'mi opinión',
  'explica',
  'historia',
]

/**
 * Detects whether an idea calls for a face-to-camera head talk.
 */
export function detectHeadTalk(ideaText: string): boolean {
  const lower = ideaText.toLowerCase()
  return HEAD_TALK_KEYWORDS.some((kw) => lower.includes(kw))
}

/**
 * Generates a simple topic hash for dedup tracking.
 */
export function generateTopicHash(text: string): string {
  const normalized = text
    .toLowerCase()
    .replace(/[^a-záéíóúñü0-9\s]/g, '')
    .trim()
  return crypto.createHash('md5').update(normalized).digest('hex').slice(0, 12)
}

// ─── Types ─────────────────────────────────────────────────────────

interface PieceSummary {
  id: string
  format: string
  status: string
  scheduledAt: string | null
  caption: string | null
  sceneSummary: string
}

interface ScriptSummary {
  ideaId: string
  hook: string
  body: string
  estimatedDuration: string
  tone: string
  notes: string
}

interface Alert {
  type: 'token_expiring' | 'low_assets' | 'low_ideas'
  message: string
  severity: 'warning' | 'info'
}

interface DailyPlanResult {
  date: string
  accountUsername: string | null
  pieces: PieceSummary[]
  scripts: ScriptSummary[]
  alerts: Alert[]
  stats: {
    total: number
    rendered: number
    published: number
    pending: number
  }
}

// ─── Core Plan Generation ──────────────────────────────────────────

/**
 * Generates a daily content plan for a given account + date.
 * Idempotent: if a plan already exists for that date, returns it.
 */
export async function generateDailyPlan(brandId: string, date: Date): Promise<DailyPlanResult> {
  const dateOnly = new Date(date.toISOString().split('T')[0])

  // 1. Fetch account info
  const account = await prisma.socialProfile.findUnique({
    where: { id: brandId },
  })

  if (!account) {
    throw new Error(`[DailyPlan] Account ${brandId} not found`)
  }

  // 2. Get existing compositions for today
  const startOfDay = new Date(dateOnly)
  const endOfDay = new Date(dateOnly)
  endOfDay.setUTCDate(endOfDay.getUTCDate() + 1)

  const todayCompositions = await prisma.post.findMany({
    where: {
      brandId,
      OR: [
        { scheduledAt: { gte: startOfDay, lt: endOfDay } },
        { createdAt: { gte: startOfDay, lt: endOfDay } },
      ],
    },
    orderBy: { scheduledAt: 'asc' },
  })

  // 3. Build pieces summary
  const pieces: PieceSummary[] = todayCompositions.map((comp) => {
    const creative = comp.creative as Record<string, unknown> | null
    const scenes = (creative?.scenes as Array<{ type: string }>) ?? []
    const sceneSummary = scenes.length > 0 ? scenes.map((s) => s.type).join(' → ') : 'No scene data'

    return {
      id: comp.id,
      format: comp.format ?? 'reel',
      status: comp.status,
      scheduledAt: comp.scheduledAt?.toISOString() ?? null,
      caption: comp.caption
        ? comp.caption.slice(0, 120) + (comp.caption.length > 120 ? '...' : '')
        : null,
      sceneSummary,
    }
  })

  // 4. Build stats
  const stats = {
    total: todayCompositions.length,
    rendered: todayCompositions.filter((c) =>
      ['rendered', 'scheduled'].includes(c.status.toLowerCase()),
    ).length,
    published: todayCompositions.filter((c) => c.status.toLowerCase() === 'published').length,
    pending: todayCompositions.filter((c) =>
      ['draft', 'approved', 'rendering'].includes(c.status.toLowerCase()),
    ).length,
  }

  // 5. Build head-talk scripts from pending ideas
  const scripts = await getHeadTalkScripts(brandId)

  // 6. Generate alerts
  const alerts = await generateAlerts(account)

  // 7. Build result
  const result: DailyPlanResult = {
    date: dateOnly.toISOString().split('T')[0],
    accountUsername: account.username ? `@${account.username}` : null,
    pieces,
    scripts,
    alerts,
    stats,
  }

  // 8. Upsert ContentPlan record
  await prisma.contentPlan.upsert({
    where: {
      brandId_date: { brandId, date: dateOnly },
    },
    create: {
      brandId,
      date: dateOnly,
      pieces: pieces as unknown as Prisma.InputJsonValue,
      scripts: scripts as unknown as Prisma.InputJsonValue,
    },
    update: {
      pieces: pieces as unknown as Prisma.InputJsonValue,
      scripts: scripts as unknown as Prisma.InputJsonValue,
      updatedAt: new Date(),
    },
  })

  return result
}

// ─── Head Talk Scripts ─────────────────────────────────────────────

/**
 * Returns pending recording scripts for ideas that require face-to-camera content.
 */
export async function getHeadTalkScripts(brandId: string): Promise<ScriptSummary[]> {
  // Find approved ideas that look like head-talk content
  const approvedIdeas = await prisma.post.findMany({
    where: {
      brandId,
      status: { in: ['IDEA_PENDING', 'IDEA_APPROVED'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  const scripts: ScriptSummary[] = []

  for (const idea of approvedIdeas) {
    if (!detectHeadTalk(idea.ideaText)) continue

    // Parse the idea text to extract hook/body if structured
    const lines = idea.ideaText.split('\n')
    const hookLine = lines.find((l) => l.startsWith('Hook:'))
    const scriptLine = lines.find((l) => l.startsWith('Script:'))

    scripts.push({
      ideaId: idea.id,
      hook: hookLine ? hookLine.replace('Hook:', '').trim() : lines[0].slice(0, 100),
      body: scriptLine ? scriptLine.replace('Script:', '').trim() : idea.ideaText.slice(0, 300),
      estimatedDuration: '~45s',
      tone: 'energetic, direct, conversational',
      notes: 'Look at camera. No B-roll — this is authentic head talk.',
    })
  }

  return scripts
}

// ─── Alerts ────────────────────────────────────────────────────────

async function generateAlerts(account: {
  id: string
  tokenExpiresAt: Date | null
}): Promise<Alert[]> {
  const alerts: Alert[] = []

  // Token expiry check
  if (account.tokenExpiresAt) {
    const daysUntilExpiry = (account.tokenExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)

    if (daysUntilExpiry <= 0) {
      alerts.push({
        type: 'token_expiring',
        message: 'IG token has EXPIRED. Re-authenticate immediately.',
        severity: 'warning',
      })
    } else if (daysUntilExpiry <= 7) {
      alerts.push({
        type: 'token_expiring',
        message: `IG token expires in ${Math.round(daysUntilExpiry)} days`,
        severity: 'warning',
      })
    }
  }

  // Low asset pool check
  const unusedVideoAssetCount = await prisma.asset.count({
    where: {
      brandId: account.id,
      type: 'VID',
      usageCount: 0,
    },
  })

  if (unusedVideoAssetCount < 5) {
    alerts.push({
      type: 'low_assets',
      message: `Only ${unusedVideoAssetCount} unused video assets remaining`,
      severity: unusedVideoAssetCount === 0 ? 'warning' : 'info',
    })
  }

  // Low ideas check
  const pendingIdeasCount = await prisma.post.count({
    where: { brandId: account.id, status: 'IDEA_PENDING' },
  })

  const approvedIdeasCount = await prisma.post.count({
    where: { brandId: account.id, status: 'IDEA_APPROVED' },
  })

  if (pendingIdeasCount + approvedIdeasCount < 3) {
    alerts.push({
      type: 'low_ideas',
      message: `Only ${pendingIdeasCount + approvedIdeasCount} ideas remaining (${approvedIdeasCount} approved)`,
      severity: 'warning',
    })
  }

  return alerts
}

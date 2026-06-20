import { prisma } from '@/modules/shared/prisma'
import type { Template } from '@/generated/prisma'
import type { ContentFormat } from '@/types/content'

/**
 * Phase 18: Template selector for the composer.
 *
 * Selection rules:
 *   - Scope: account's own templates PLUS workspace-scoped templates from sibling
 *     accounts inside the same workspace.
 *   - Each candidate must have an `BrandTemplateConfig` row for this account with
 *     `enabled = true`.
 *   - Format: Template.sceneType or Template.config.format (loose match) must align
 *     with the idea's format. If no template declares a format preference we fall
 *     back to any template with an enabled config.
 *   - Ordering: usage-weighted random — prefers templates that haven't been used
 *     recently (lastUsedAt asc), breaking ties randomly.
 *
 * Returns null if nothing matches (caller decides how to degrade).
 */
export async function selectTemplateForIdea(params: {
  brandId: string
  format: ContentFormat
}): Promise<Template | null> {
  const { brandId, format } = params

  const account = await prisma.socialProfile.findUnique({
    where: { id: brandId },
    select: { workspaceId: true },
  })
  if (!account) return null

  // Candidate templates = own templates OR workspace-scoped templates from the same workspace.
  const siblingAccountIds = (
    await prisma.socialProfile.findMany({
      where: { workspaceId: account.workspaceId },
      select: { id: true },
    })
  ).map((a) => a.id)

  const candidates = await prisma.template.findMany({
    where: {
      OR: [
        { brandId },
        {
          brandId: { in: siblingAccountIds },
          scope: 'workspace',
        },
      ],
      brandConfigs: {
        some: { brandId, enabled: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  if (candidates.length === 0) return null

  // Two-pass format match to prioritize exact matches (e.g. trial_reel idea -> trial_reel template)
  // over loose fallback matches.
  const isExactMatch = (t: Template): boolean => {
    if (t.format === format) return true
    const configFormat =
      typeof t.config === 'object' && t.config && 'format' in t.config
        ? String((t.config as Record<string, unknown>).format)
        : null
    if (configFormat === format) return true
    if (t.sceneType && t.sceneType === format) return true
    return false
  }

  const isLooseMatch = (t: Template): boolean => {
    // Explicit exclusions: "trial_*" templates are ONLY for their specific formats.
    if (t.format === 'trial_reel' && format !== 'trial_reel') return false
    if (t.format === 'trial_head_talk' && format !== 'trial_head_talk') return false

    const configFormat =
      typeof t.config === 'object' && t.config && 'format' in t.config
        ? String((t.config as Record<string, unknown>).format)
        : null

    // Reels vs trial_reels fallback (Phase 18).
    if (format === 'trial_reel' && (t.format === 'reel' || configFormat === 'reel' || t.sceneType === 'reel')) return true
    if (format === 'reel' && (t.format === 'reel' || configFormat === 'reel' || t.sceneType === 'reel')) return true

    // Head talk fallback.
    if (format === 'trial_head_talk' && (t.format === 'head_talk' || configFormat === 'head_talk' || t.sceneType === 'head_talk')) return true
    if (format === 'head_talk' && (t.format === 'head_talk' || configFormat === 'head_talk' || t.sceneType === 'head_talk')) return true

    // If a template declares no format, treat it as universal.
    return !t.format && !configFormat && !t.sceneType
  }

  const exactMatches = candidates.filter(isExactMatch)
  const looseMatches = candidates.filter(isLooseMatch)
  const pool = exactMatches.length > 0 ? exactMatches : (looseMatches.length > 0 ? looseMatches : candidates)

  // Usage-weighted: count recent Post usage per template and prefer the least-used.
  const recentWindow = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const usageCounts = await prisma.post.groupBy({
    by: ['templateId'],
    where: {
      templateId: { in: pool.map((t) => t.id) },
      createdAt: { gte: recentWindow },
    },
    _count: { _all: true },
  })
  const usageMap = new Map<string, number>(
    usageCounts.map((u) => [u.templateId as string, u._count._all]),
  )

  const minUsage = Math.min(...pool.map((t) => usageMap.get(t.id) ?? 0))
  const leastUsed = pool.filter((t) => (usageMap.get(t.id) ?? 0) === minUsage)

  // Random pick within the least-used bucket.
  return leastUsed[Math.floor(Math.random() * leastUsed.length)]
}

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

  // Loose format match: look at sceneType and config.format (if present).
  const matchesFormat = (t: Template): boolean => {
    const configFormat =
      typeof t.config === 'object' && t.config && 'format' in t.config
        ? String((t.config as Record<string, unknown>).format)
        : null
    if (configFormat === format) return true
    if (t.sceneType && t.sceneType === format) return true
    // Reels vs trial_reels use the same template per Phase 18 decision.
    if ((format === 'reel' || format === 'trial_reel') && configFormat === 'reel') return true
    if ((format === 'reel' || format === 'trial_reel') && t.sceneType === 'reel') return true
    // If a template declares no format, treat it as universal.
    return !configFormat && !t.sceneType
  }

  const filtered = candidates.filter(matchesFormat)
  const pool = filtered.length > 0 ? filtered : candidates

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

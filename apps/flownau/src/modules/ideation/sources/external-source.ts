import { prisma } from '@/modules/shared/prisma'
import { logger } from '@/modules/shared/logger'

// Canonical source values as stored in the DB
type IdeaSource = 'automatic' | 'manual' | 'captured'

// Priority by source — captured ideas are highest priority
const SOURCE_PRIORITY: Record<IdeaSource, number> = {
  captured: 1,
  manual: 2,
  automatic: 3,
}

// Legacy source values accepted from external callers (ingest API backward compat)
type LegacySource = 'inspo' | 'user_input' | 'reactive' | 'captured'

function normalizeLegacySource(source: LegacySource | IdeaSource): IdeaSource {
  switch (source) {
    case 'captured':
    case 'reactive': // reactive = user-triggered capture, same priority
      return 'captured'
    case 'user_input':
    case 'manual':
      return 'manual'
    case 'inspo':
    case 'automatic':
    default:
      return 'automatic'
  }
}

interface ExternalIdeaInput {
  accountId: string
  text: string
  source: LegacySource | IdeaSource
  sourceRef?: string
}

/**
 * Ingests a single external idea into the ContentIdea table.
 * Prevents duplicates by checking for similar ideaText within the last 7 days.
 */
export async function ingestExternalIdea(params: ExternalIdeaInput) {
  const { accountId, text, sourceRef } = params
  const source = normalizeLegacySource(params.source)

  // Check for near-duplicates in last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const existingIdea = await prisma.contentIdea.findFirst({
    where: {
      accountId,
      ideaText: text,
      createdAt: { gte: sevenDaysAgo },
    },
  })

  if (existingIdea) {
    logger.info(
      `[ExternalSource] Duplicate idea skipped for account ${accountId}: "${text.slice(0, 50)}..."`,
    )
    return existingIdea
  }

  const idea = await prisma.contentIdea.create({
    data: {
      accountId,
      ideaText: text,
      source,
      priority: SOURCE_PRIORITY[source],
      sourceRef: sourceRef ?? null,
      status: source === 'captured' ? 'APPROVED' : 'PENDING',
    },
  })

  logger.info(
    `[ExternalSource] Ingested idea ${idea.id} for account ${accountId} (source: ${source}, priority: ${SOURCE_PRIORITY[source]})`,
  )
  return idea
}

/**
 * Bulk ingest external ideas with deduplication.
 */
export async function ingestExternalIdeas(
  accountId: string,
  ideas: Array<{
    text: string
    source: LegacySource | IdeaSource
    sourceRef?: string
  }>,
  autoApprove = false,
): Promise<{ created: number; ids: string[] }> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  // Fetch recent idea texts for dedup
  const recentIdeas = await prisma.contentIdea.findMany({
    where: { accountId, createdAt: { gte: sevenDaysAgo } },
    select: { ideaText: true },
  })
  const recentTexts = new Set(recentIdeas.map((i) => i.ideaText))

  const createdIds: string[] = []

  for (const idea of ideas) {
    if (recentTexts.has(idea.text)) {
      logger.info(`[ExternalSource] Duplicate skipped: "${idea.text.slice(0, 50)}..."`)
      continue
    }

    const source = normalizeLegacySource(idea.source)

    const created = await prisma.contentIdea.create({
      data: {
        accountId,
        ideaText: idea.text,
        source,
        priority: SOURCE_PRIORITY[source],
        sourceRef: idea.sourceRef ?? null,
        status: autoApprove || source === 'captured' ? 'APPROVED' : 'PENDING',
      },
    })

    createdIds.push(created.id)
    recentTexts.add(idea.text) // Prevent intra-batch duplicates
  }

  logger.info(
    `[ExternalSource] Bulk ingested ${createdIds.length}/${ideas.length} ideas for account ${accountId}`,
  )

  const hasCaptured = ideas.some((i) => normalizeLegacySource(i.source) === 'captured')
  if (hasCaptured) {
    logger.info(
      `[ExternalSource] Captured idea detected. Triggering immediate composer generation.`,
    )
    // Fire and forget — non-blocking
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const cronSecret = process.env.CRON_SECRET

    // Trigger immediate composer generation with cron-secret auth
    fetch(new URL('/api/cron/composer', appUrl).toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${cronSecret}`,
      },
    }).catch((e) => logger.error('[ExternalSource] Failed to trigger immediate composer', e))
  }

  return { created: createdIds.length, ids: createdIds }
}

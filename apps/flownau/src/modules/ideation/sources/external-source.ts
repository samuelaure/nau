import { prisma } from '@/modules/shared/prisma'
import { logger } from '@/modules/shared/logger'

interface ExternalIdeaInput {
  accountId: string
  text: string
  source: 'inspo' | 'user_input' | 'reactive'
  sourceRef?: string
}

/**
 * Ingests an external idea into the ContentIdea table.
 * Prevents duplicates by checking for similar ideaText within the last 7 days.
 */
export async function ingestExternalIdea(params: ExternalIdeaInput) {
  const { accountId, text, source, sourceRef } = params

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
      sourceRef: sourceRef ?? null,
      status: 'PENDING',
    },
  })

  logger.info(
    `[ExternalSource] Ingested idea ${idea.id} for account ${accountId} (source: ${source})`,
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
    source: 'inspo' | 'user_input' | 'reactive' | 'captured'
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

    const created = await prisma.contentIdea.create({
      data: {
        accountId,
        ideaText: idea.text,
        source: idea.source,
        sourceRef: idea.sourceRef ?? null,
        status: autoApprove || idea.source === 'captured' ? 'APPROVED' : 'PENDING',
      },
    })

    createdIds.push(created.id)
    recentTexts.add(idea.text) // Prevent intra-batch duplicates
  }

  logger.info(
    `[ExternalSource] Bulk ingested ${createdIds.length}/${ideas.length} ideas for account ${accountId}`,
  )

  const hasCaptured = ideas.some((i) => i.source === 'captured')
  if (hasCaptured) {
    logger.info(
      `[ExternalSource] Captured idea detected. Triggering immediate composer generation.`,
    )
    // Fire and forget cron execution to compile approved ideas
    // We do this non-blocking
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    fetch(new URL('/api/cron/composer', appUrl).toString(), { method: 'GET' }).catch((e) =>
      logger.error('[ExternalSource] Failed to trigger immediate composer', e),
    )
  }

  return { created: createdIds.length, ids: createdIds }
}

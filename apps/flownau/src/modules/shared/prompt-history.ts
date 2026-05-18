import { prisma } from './prisma'

export type PromptEntityType = 'brand' | 'brand_account_template' | 'template' | 'content_planner'

/**
 * Record a prompt field change.
 * Closes the currently active entry (if any) and opens a new one.
 * No-ops if the new value equals the current active value.
 */
export async function recordPromptChange(
  entityType: PromptEntityType,
  entityId: string,
  field: string,
  newContent: string | null,
): Promise<void> {
  const content = newContent?.trim() ?? ''
  if (!content) return

  const now = new Date()

  const active = await prisma.promptHistory.findFirst({
    where: { entityType, entityId, field, replacedAt: null },
    orderBy: { activeSince: 'desc' },
  })

  if (active?.content === content) return

  await prisma.$transaction([
    ...(active
      ? [prisma.promptHistory.update({ where: { id: active.id }, data: { replacedAt: now } })]
      : []),
    prisma.promptHistory.create({
      data: { entityType, entityId, field, content, activeSince: now },
    }),
  ])
}

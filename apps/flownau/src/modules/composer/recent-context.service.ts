import { prisma } from '@/modules/shared/prisma'

export async function getRecentDraftContext(brandId: string, windowDays = 30): Promise<string | null> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)
  const posts = await prisma.post.findMany({
    where: { brandId, createdAt: { gte: since }, caption: { not: null } },
    select: { caption: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  if (posts.length === 0) return null

  const lines = posts.map((p) => `- ${p.caption!.slice(0, 120)}`).join('\n')
  return `RECENT PUBLISHED CONTENT — do not repeat these themes, hooks, or angles:\n${lines}`
}

import { prisma } from '@/modules/shared/prisma'

export interface IdeationProvenance {
  ideasFrameworkId: string | null
  contentPrinciplesId: string | null
}

export interface ResolvedProvenance extends IdeationProvenance {
  frameworkSystemPrompt: string | null
  principlesSystemPrompt: string | null
}

async function resolveFramework(brandId: string, overrideId?: string | null) {
  if (overrideId) return prisma.ideasFramework.findUnique({ where: { id: overrideId } })
  const def = await prisma.ideasFramework.findFirst({ where: { brandId, isDefault: true } })
  if (def) return def
  return prisma.ideasFramework.findFirst({ where: { brandId } })
}

async function resolvePrinciples(brandId: string, overrideId?: string | null) {
  if (overrideId) return prisma.contentCreationPrinciples.findUnique({ where: { id: overrideId } })
  const def = await prisma.contentCreationPrinciples.findFirst({ where: { brandId, isDefault: true } })
  if (def) return def
  return prisma.contentCreationPrinciples.findFirst({ where: { brandId } })
}

/**
 * Resolves IdeasFramework and ContentCreationPrinciples for a brand.
 */
export async function resolveProvenance(
  brandId: string,
  overrides: Partial<IdeationProvenance> = {},
): Promise<ResolvedProvenance> {
  const [framework, principles] = await Promise.all([
    resolveFramework(brandId, overrides.ideasFrameworkId),
    resolvePrinciples(brandId, overrides.contentPrinciplesId),
  ])

  return {
    ideasFrameworkId: framework?.id ?? null,
    contentPrinciplesId: principles?.id ?? null,
    frameworkSystemPrompt: framework?.systemPrompt ?? null,
    principlesSystemPrompt: principles?.systemPrompt ?? null,
  }
}

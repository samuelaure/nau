import { prisma } from '@/modules/shared/prisma'

export interface IdeationProvenance {
  brandPersonaId: string | null
  ideasFrameworkId: string | null
  contentPrinciplesId: string | null
}

export interface ResolvedProvenance extends IdeationProvenance {
  personaSystemPrompt: string | null
  personaName: string | null
  frameworkSystemPrompt: string | null
  principlesSystemPrompt: string | null
}

async function resolvePersona(accountId: string, overrideId?: string | null) {
  if (overrideId) return prisma.brandPersona.findUnique({ where: { id: overrideId } })
  const defaultPersona = await prisma.brandPersona.findFirst({
    where: { accountId, isDefault: true },
  })
  if (defaultPersona) return defaultPersona
  return prisma.brandPersona.findFirst({ where: { accountId } })
}

async function resolveFramework(accountId: string, overrideId?: string | null) {
  if (overrideId) return prisma.ideasFramework.findUnique({ where: { id: overrideId } })
  const def = await prisma.ideasFramework.findFirst({
    where: { accountId, isDefault: true },
  })
  if (def) return def
  return prisma.ideasFramework.findFirst({ where: { accountId } })
}

async function resolvePrinciples(accountId: string, overrideId?: string | null) {
  if (overrideId) return prisma.contentCreationPrinciples.findUnique({ where: { id: overrideId } })
  const def = await prisma.contentCreationPrinciples.findFirst({
    where: { accountId, isDefault: true },
  })
  if (def) return def
  return prisma.contentCreationPrinciples.findFirst({ where: { accountId } })
}

/**
 * Resolves the default (or explicitly selected) BrandPersona, IdeasFramework,
 * and ContentCreationPrinciples for an account. Used by ideation (to persist
 * on ContentIdea) and content development (to carry forward the same narrative).
 */
export async function resolveProvenance(
  accountId: string,
  overrides: Partial<IdeationProvenance> = {},
): Promise<ResolvedProvenance> {
  const [persona, framework, principles] = await Promise.all([
    resolvePersona(accountId, overrides.brandPersonaId),
    resolveFramework(accountId, overrides.ideasFrameworkId),
    resolvePrinciples(accountId, overrides.contentPrinciplesId),
  ])

  return {
    brandPersonaId: persona?.id ?? null,
    ideasFrameworkId: framework?.id ?? null,
    contentPrinciplesId: principles?.id ?? null,
    personaSystemPrompt: persona?.systemPrompt ?? null,
    personaName: persona?.name ?? null,
    frameworkSystemPrompt: framework?.systemPrompt ?? null,
    principlesSystemPrompt: principles?.systemPrompt ?? null,
  }
}

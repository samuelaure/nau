import { prisma } from '@/modules/shared/prisma'
import { logger } from '@/modules/shared/logger'

/**
 * Fetches the Brand DNA (BrandPersona system prompt) for an account.
 * This is the fallback ideation source when InspoItems are unavailable.
 */
export async function getBrandDNA(brandId: string): Promise<string> {
  const persona = await prisma.brandPersona.findFirst({
    where: { brandId, isDefault: true },
  })

  if (!persona) {
    // Fall back to any persona for the account
    const anyPersona = await prisma.brandPersona.findFirst({
      where: { brandId },
    })

    if (!anyPersona) {
      logger.warn(`[BrandDNA] No BrandPersona found for account ${brandId}`)
      return 'No brand identity configured.'
    }

    return anyPersona.systemPrompt
  }

  return persona.systemPrompt
}

import { prisma } from '@/modules/shared/prisma'
import { renderBrandContextBlock } from '@/modules/prompts/brand-context'

/**
 * Fetches the brand DNA — a rendered BrandContext block — for ideation fallback.
 * Used when InspoItems are unavailable.
 */
export async function getBrandDNA(brandId: string): Promise<string> {
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { name: true, context: true },
  })

  if (!brand) return 'No brand identity configured.'

  const block = renderBrandContextBlock({ name: brand.name ?? null, context: brand.context ?? null }).trim()
  return block || 'No brand identity configured.'
}

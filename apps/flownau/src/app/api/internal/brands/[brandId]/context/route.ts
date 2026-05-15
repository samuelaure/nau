export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { validateServiceToken, unauthorizedResponse } from '@/modules/shared/nau-auth'
import { prisma } from '@/modules/shared/prisma'

/**
 * PATCH /api/internal/brands/:brandId/context
 * Called by nauthenticity after generating or saving brand context.
 * Writes Brand.context (plain text) for prompt kernel consumption.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> },
) {
  if (!(await validateServiceToken(req))) return unauthorizedResponse()

  const { brandId } = await params
  const body = await req.json()
  const { context } = body as { context: unknown }

  if (!context || typeof context !== 'string') {
    return NextResponse.json({ error: 'context must be a string' }, { status: 400 })
  }

  await prisma.brand.update({
    where: { id: brandId },
    data: { context },
  })

  return NextResponse.json({ success: true })
}

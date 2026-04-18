import { NextResponse } from 'next/server'
import { validateServiceKey, unauthorizedResponse } from '@/modules/shared/nau-auth'
import { prisma } from '@/modules/shared/prisma'

/**
 * GET /api/v1/accounts/by-nau-brand/:brandId
 * Resolves a nauthenticity Brand.id to a local SocialAccount.id.
 * Called by: 9naŭ API (triage module) to find the correct accountId before ingesting ideas.
 * Auth: NAU_SERVICE_KEY
 */
export async function GET(
  req: Request,
  { params }: { params: { brandId: string } },
) {
  if (!validateServiceKey(req)) {
    return unauthorizedResponse()
  }

  const { brandId } = await params

  try {
    const account = await prisma.socialAccount.findFirst({
      where: { brandId },
      select: {
        id: true,
        platform: true,
        username: true,
        brandId: true,
        workspaceId: true,
      },
    })

    if (!account) {
      return NextResponse.json(
        { error: `No SocialAccount found for brandId: ${brandId}` },
        { status: 404 },
      )
    }

    return NextResponse.json({ account })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to resolve account'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

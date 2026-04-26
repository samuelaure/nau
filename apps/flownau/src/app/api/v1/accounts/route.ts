export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { validateServiceToken, unauthorizedResponse } from '@/modules/shared/nau-auth'
import { prisma } from '@/modules/shared/prisma'

/**
 * GET /api/v1/accounts — List social accounts.
 * Called by: Zazŭ (to resolve account IDs)
 * Auth: NAU_SERVICE_KEY
 */
export async function GET(req: Request) {
  if (!(await validateServiceToken(req))) {
    return unauthorizedResponse()
  }

  try {
    const accounts = await prisma.socialProfile.findMany({
      select: {
        id: true,
        platform: true,
        username: true,
        profileImage: true,
        platformId: true,
      },
    })

    return NextResponse.json({ accounts })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch accounts'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

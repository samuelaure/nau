export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'

export async function GET(req: NextRequest) {
  const workspaceId = req.nextUrl.searchParams.get('workspaceId')
  if (!workspaceId) return NextResponse.json({ accounts: [] })

  const accounts = await prisma.socialProfile.findMany({
    where: { workspaceId },
    select: { id: true, username: true, profileImage: true },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({ accounts })
}

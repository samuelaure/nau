import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { accountId, templateId } = await req.json()

    if (!accountId && !templateId) {
      return NextResponse.json({ error: 'Missing context' }, { status: 400 })
    }

    // Purge existing assets to clean up the scoped library
    if (accountId) {
      await prisma.asset.deleteMany({ where: { accountId } })
      await prisma.socialAccount.update({
        where: { id: accountId },
        data: { assetsRoot: null },
      })
    } else if (templateId) {
      await prisma.asset.deleteMany({ where: { templateId } })
      await prisma.template.update({
        where: { id: templateId },
        data: { assetsRoot: null },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Failed to unlink R2 folder', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

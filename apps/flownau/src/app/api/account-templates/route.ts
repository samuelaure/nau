export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'

/**
 * GET /api/account-templates?accountId=
 * Lists all templates visible to the account (own + workspace-shared) with their
 * AccountTemplateConfig settings for this account.
 *
 * PUT /api/account-templates
 * Body: { accountId, templateId, autoApprovePost?, enabled? }
 * Upserts AccountTemplateConfig for (accountId, templateId).
 *
 * POST /api/account-templates
 * Body: { accountId, templateId }
 * Enables a workspace-scoped template for an account (creates config row).
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const accountId = searchParams.get('accountId')
    if (!accountId) return NextResponse.json({ error: 'Missing accountId' }, { status: 400 })

    const account = await prisma.socialAccount.findUnique({
      where: { id: accountId },
      select: { workspaceId: true },
    })
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

    const siblingIds = (
      await prisma.socialAccount.findMany({
        where: { workspaceId: account.workspaceId },
        select: { id: true },
      })
    ).map((a) => a.id)

    const templates = await prisma.template.findMany({
      where: {
        OR: [{ accountId }, { accountId: { in: siblingIds }, scope: 'workspace' }],
      },
      include: {
        accountConfigs: { where: { accountId } },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ templates }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch account templates' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json()
    const { accountId, templateId, autoApprovePost, enabled } = body

    if (!accountId || !templateId) {
      return NextResponse.json({ error: 'Missing accountId or templateId' }, { status: 400 })
    }

    const config = await prisma.accountTemplateConfig.upsert({
      where: { accountId_templateId: { accountId, templateId } },
      create: {
        accountId,
        templateId,
        autoApprovePost: autoApprovePost ?? false,
        enabled: enabled ?? true,
      },
      update: {
        ...(autoApprovePost !== undefined && { autoApprovePost }),
        ...(enabled !== undefined && { enabled }),
      },
    })

    return NextResponse.json({ config }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Failed to update account template config' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { accountId, templateId } = body

    if (!accountId || !templateId) {
      return NextResponse.json({ error: 'Missing accountId or templateId' }, { status: 400 })
    }

    const config = await prisma.accountTemplateConfig.upsert({
      where: { accountId_templateId: { accountId, templateId } },
      create: { accountId, templateId, autoApprovePost: false, enabled: true },
      update: { enabled: true },
    })

    return NextResponse.json({ config }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to enable template for account' }, { status: 500 })
  }
}

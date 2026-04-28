export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'

/**
 * GET /api/account-templates?brandId=
 * Lists all templates visible to the account (own + workspace-shared) with their
 * BrandTemplateConfig settings for this account.
 *
 * PUT /api/account-templates
 * Body: { brandId, templateId, autoApprovePost?, enabled? }
 * Upserts BrandTemplateConfig for (brandId, templateId).
 *
 * POST /api/account-templates
 * Body: { brandId, templateId }
 * Enables a workspace-scoped template for an account (creates config row).
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const brandId = searchParams.get('brandId')
    if (!brandId) return NextResponse.json({ error: 'Missing brandId' }, { status: 400 })

    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { workspaceId: true },
    })
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 })

    const siblingIds = (
      await prisma.brand.findMany({
        where: { workspaceId: brand.workspaceId },
        select: { id: true },
      })
    ).map((b) => b.id)

    const templates = await prisma.template.findMany({
      where: {
        OR: [
          { brandId },
          { brandId: { in: siblingIds }, scope: 'workspace' },
          { scope: 'system' },
        ],
      },
      include: {
        brandConfigs: { where: { brandId } },
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
    const { brandId, templateId, autoApprovePost, enabled } = body

    if (!brandId || !templateId) {
      return NextResponse.json({ error: 'Missing brandId or templateId' }, { status: 400 })
    }

    const config = await prisma.brandTemplateConfig.upsert({
      where: { brandId_templateId: { brandId, templateId } },
      create: {
        brandId,
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
    const { brandId, templateId } = body

    if (!brandId || !templateId) {
      return NextResponse.json({ error: 'Missing brandId or templateId' }, { status: 400 })
    }

    const config = await prisma.brandTemplateConfig.upsert({
      where: { brandId_templateId: { brandId, templateId } },
      create: { brandId, templateId, autoApprovePost: false, enabled: true },
      update: { enabled: true },
    })

    return NextResponse.json({ config }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to enable template for account' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { recordPromptChange } from '@/modules/shared/prompt-history'

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
        OR: [{ brandId }, { brandId: { in: siblingIds }, scope: 'workspace' }, { scope: 'system' }],
      },
      include: {
        brandConfigs: { where: { brandId } },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ templates }, { status: 200 })
  } catch (err) {
    console.error('[account-templates GET]', err)
    return NextResponse.json({ error: 'Failed to fetch account templates' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json()
    const {
      brandId,
      templateId,
      autoApproveDraft,
      autoApprovePost,
      enabled,
      customName,
      customPrompt,
      slotOverrides,
    } = body

    if (!brandId || !templateId) {
      return NextResponse.json({ error: 'Missing brandId or templateId' }, { status: 400 })
    }

    const config = await prisma.brandTemplateConfig.upsert({
      where: { brandId_templateId: { brandId, templateId } },
      create: {
        brandId,
        templateId,
        autoApproveDraft: autoApproveDraft ?? false,
        autoApprovePost: autoApprovePost ?? false,
        enabled: enabled ?? true,
        customName: customName ?? null,
        customPrompt: customPrompt ?? null,
        slotOverrides: slotOverrides ?? null,
      },
      update: {
        ...(autoApproveDraft !== undefined && { autoApproveDraft }),
        ...(autoApprovePost !== undefined && { autoApprovePost }),
        ...(enabled !== undefined && { enabled }),
        ...(customName !== undefined && { customName: customName || null }),
        ...(customPrompt !== undefined && { customPrompt: customPrompt || null }),
        ...(slotOverrides !== undefined && { slotOverrides: slotOverrides || null }),
      },
    })

    if (customName !== undefined) {
      await recordPromptChange('brand_account_template', config.id, 'customName', customName)
    }
    if (customPrompt !== undefined) {
      await recordPromptChange('brand_account_template', config.id, 'customPrompt', customPrompt)
    }

    return NextResponse.json({ config }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Failed to update account template config' }, { status: 500 })
  }
}

/**
 * DELETE /api/account-templates?brandId=&templateId=
 * Brand-scoped template  → permanently deletes the Template record (cascade removes BrandTemplateConfig).
 * System/workspace template → only removes the BrandTemplateConfig, leaving the gallery intact.
 */
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const brandId = searchParams.get('brandId')
    const templateId = searchParams.get('templateId')
    if (!brandId || !templateId) {
      return NextResponse.json({ error: 'Missing brandId or templateId' }, { status: 400 })
    }

    const template = await prisma.template.findUnique({
      where: { id: templateId },
      select: { scope: true, brandId: true },
    })
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    if (template.scope === 'brand' && template.brandId === brandId) {
      // Fully owned by this brand — delete the template (cascades to BrandTemplateConfig)
      await prisma.template.delete({ where: { id: templateId } })
    } else {
      // System or workspace template — only disconnect the brand's config
      await prisma.brandTemplateConfig.deleteMany({
        where: { brandId, templateId },
      })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })
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

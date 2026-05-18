import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'

export async function POST(req: Request) {
  try {
    const { brandId, templateId } = (await req.json()) as { brandId?: string; templateId?: string }
    if (!brandId || !templateId) {
      return NextResponse.json({ error: 'Missing brandId or templateId' }, { status: 400 })
    }

    const [template, config] = await Promise.all([
      prisma.template.findUnique({ where: { id: templateId } }),
      prisma.brandTemplateConfig.findUnique({
        where: { brandId_templateId: { brandId, templateId } },
      }),
    ])
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

    const baseName = config?.customName || template.name
    const newTemplate = await prisma.template.create({
      data: {
        name: `Copy of ${baseName}`,
        format: template.format,
        remotionId: template.remotionId,
        config: template.config ?? undefined,
        brandId,
        scope: 'brand',
        useBrandAssets: template.useBrandAssets,
        assetsRoot: template.assetsRoot,
        systemPrompt: template.systemPrompt,
        creationPrompt: template.creationPrompt,
        captionPrompt: template.captionPrompt,
        schemaJson: template.schemaJson ?? undefined,
        contentSchema: template.contentSchema ?? undefined,
        sceneType: template.sceneType,
        slotSchema: template.slotSchema ?? undefined,
        styleConfig: template.styleConfig ?? undefined,
        description: template.description,
        previewUrl: template.previewUrl,
        previewThumbnailUrl: template.previewThumbnailUrl,
        brandConfigs: {
          create: {
            brandId,
            enabled: config?.enabled ?? true,
            autoApproveDraft: config?.autoApproveDraft ?? false,
            autoApprovePost: config?.autoApprovePost ?? false,
            customName: config?.customName ? `Copy of ${config.customName}` : null,
            customPrompt: config?.customPrompt ?? null,
            slotOverrides: config?.slotOverrides ?? undefined,
          },
        },
      },
      include: { brandConfigs: { where: { brandId } } },
    })

    return NextResponse.json({ template: newTemplate }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to duplicate template' }, { status: 500 })
  }
}

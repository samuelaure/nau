import { prisma } from '../src/modules/shared/prisma'

async function main() {
  console.log('Starting template cleanup and migration...')

  // 1. Migrate shared gallery templates that are ENABLED by brands
  const galleryTemplates = await prisma.template.findMany({
    where: { scope: { in: ['system', 'workspace'] } },
    include: { brandConfigs: true },
  })

  console.log(`Found ${galleryTemplates.length} gallery (system/workspace) templates.`)

  for (const t of galleryTemplates) {
    const enabledConfigs = t.brandConfigs.filter((c) => c.enabled)
    const disabledConfigs = t.brandConfigs.filter((c) => !c.enabled)

    // For each brand that has it enabled, create a brand-scoped clone
    for (const config of enabledConfigs) {
      console.log(`Duplicating template ${t.name} (${t.id}) for brand ${config.brandId}`)
      
      const newTemplate = await prisma.template.create({
        data: {
          name: t.name, // Keep exact name
          format: t.format,
          remotionId: t.remotionId,
          config: t.config ?? undefined,
          brandId: config.brandId,
          scope: 'brand',
          useBrandAssets: t.useBrandAssets,
          assetsRoot: t.assetsRoot,
          systemPrompt: t.systemPrompt,
          creationPrompt: t.creationPrompt,
          captionPrompt: t.captionPrompt,
          schemaJson: t.schemaJson ?? undefined,
          contentSchema: t.contentSchema ?? undefined,
          sceneType: t.sceneType,
          slotSchema: t.slotSchema ?? undefined,
          styleConfig: t.styleConfig ?? undefined,
          description: t.description,
          previewUrl: t.previewUrl,
          previewThumbnailUrl: t.previewThumbnailUrl,
          scenes: t.scenes ?? undefined,
        },
      })

      // Move the post references to the new template
      await prisma.post.updateMany({
        where: { brandId: config.brandId, templateId: t.id },
        data: { templateId: newTemplate.id },
      })

      // Move asset references
      await prisma.asset.updateMany({
        where: { brandId: config.brandId, templateId: t.id },
        data: { templateId: newTemplate.id },
      })

      // Create new brand config
      await prisma.brandTemplateConfig.create({
        data: {
          brandId: config.brandId,
          templateId: newTemplate.id,
          autoApproveDraft: config.autoApproveDraft,
          autoApprovePost: config.autoApprovePost,
          enabled: true,
          customName: config.customName,
          customPrompt: config.customPrompt,
          slotOverrides: config.slotOverrides ?? undefined,
        },
      })
    }

    // Delete all existing configs for this gallery template
    await prisma.brandTemplateConfig.deleteMany({
      where: { templateId: t.id },
    })

    // Remove foreign key references before deleting the gallery template
    await prisma.post.updateMany({
      where: { templateId: t.id },
      data: { templateId: null },
    })

    await prisma.asset.updateMany({
      where: { templateId: t.id },
      data: { templateId: null },
    })

    await prisma.render.deleteMany({
      where: { templateId: t.id },
    })

    // Delete the gallery template
    await prisma.template.delete({
      where: { id: t.id },
    })
    console.log(`Deleted gallery template ${t.name} (${t.id}).`)
  }

  // 2. Clean up disabled brand templates
  const disabledBrandConfigs = await prisma.brandTemplateConfig.findMany({
    where: { enabled: false },
  })

  console.log(`Found ${disabledBrandConfigs.length} disabled brand template configs.`)

  for (const config of disabledBrandConfigs) {
    // Delete the config
    await prisma.brandTemplateConfig.delete({
      where: { id: config.id },
    })

    // If the template is brand-scoped, and now has no other configs, delete it
    const template = await prisma.template.findUnique({
      where: { id: config.templateId },
      include: { brandConfigs: true },
    })

    if (template && template.scope === 'brand' && template.brandConfigs.length === 0) {
      console.log(`Deleting disabled brand template ${template.name} (${template.id}).`)
      
      // Nullify references
      await prisma.post.updateMany({
        where: { templateId: template.id },
        data: { templateId: null },
      })

      await prisma.asset.updateMany({
        where: { templateId: template.id },
        data: { templateId: null },
      })

      await prisma.render.deleteMany({
        where: { templateId: template.id },
      })

      // Delete the template
      await prisma.template.delete({
        where: { id: template.id },
      })
    }
  }

  console.log('Cleanup and migration completed successfully.')
}

main()
  .catch((e) => {
    console.error('Migration failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

'use server'

import { prisma } from '@/modules/shared/prisma'
import { revalidatePath } from 'next/cache'
import { checkAuth } from '@/modules/shared/actions'
import { z } from 'zod'
import { TemplateSchema } from '@/types/video-schema'

// Schemas
const TemplateFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  remotionId: z.string().min(1, 'Remotion ID is required'),
  brandId: z
    .string()
    .optional()
    .nullable()
    .transform((val) => val || null),
  systemPrompt: z
    .string()
    .optional()
    .nullable()
    .transform((val) => val || null),
  creationPrompt: z
    .string()
    .optional()
    .nullable()
    .transform((val) => val || null),
})

const IdSchema = z.string().min(1)

const ToggleTemplateAssetsSchema = z.object({
  templateId: z.string().min(1),
  useBrandAssets: z.boolean(),
})

export async function addTemplate(formData: FormData) {
  await checkAuth()

  const rawData = {
    name: formData.get('name'),
    remotionId: formData.get('remotionId'),
    brandId: formData.get('brandId'),
  }

  const { brandId, ...templateData } = TemplateFormSchema.parse(rawData)

  await (prisma.template.create as any)({
    data: {
      ...templateData,
      account: brandId ? { connect: { id: brandId } } : undefined,
    },
  })

  revalidatePath('/dashboard/templates')
}

export async function deleteTemplate(id: string) {
  await checkAuth()
  const parsedId = IdSchema.parse(id)

  // Delete dependants in order before deleting the template
  await prisma.composition.deleteMany({ where: { templateId: parsedId } })
  await prisma.render.deleteMany({ where: { templateId: parsedId } })
  await prisma.asset.deleteMany({ where: { templateId: parsedId } })
  await prisma.template.delete({ where: { id: parsedId } })

  revalidatePath('/dashboard/templates')
}

export async function updateTemplate(id: string, formData: FormData) {
  await checkAuth()
  const parsedId = IdSchema.parse(id)

  const rawData = {
    name: formData.get('name'),
    remotionId: formData.get('remotionId'),
    brandId: formData.get('brandId'),
    systemPrompt: formData.get('systemPrompt'),
    creationPrompt: formData.get('creationPrompt'),
  }

  const { brandId, ...templateData } = TemplateFormSchema.parse(rawData)

  await (prisma.template.update as any)({
    where: { id: parsedId },
    data: {
      ...templateData,
      account: brandId ? { connect: { id: brandId } } : { disconnect: true },
    },
  })

  revalidatePath('/dashboard/templates')
  revalidatePath(`/dashboard/templates/${parsedId}`)
}

export async function duplicateTemplate(id: string) {
  await checkAuth()
  const parsedId = IdSchema.parse(id)

  const template = await prisma.template.findUnique({ where: { id: parsedId } })
  if (!template) throw new Error('Template not found')

  await (prisma.template.create as any)({
    data: {
      name: `${template.name} (Copy)`,
      remotionId: template.remotionId,
      brand: template.brandId ? { connect: { id: template.brandId } } : undefined,
      useBrandAssets: template.useBrandAssets,
      systemPrompt: (template as any).systemPrompt,
      creationPrompt: (template as any).creationPrompt,
    },
  })

  revalidatePath('/dashboard/templates')
}

export async function saveTemplateConfig(id: string, config: unknown) {
  await checkAuth()
  const parsedId = IdSchema.parse(id)
  const parsedConfig = TemplateSchema.parse(config)

  await prisma.template.update({
    where: { id: parsedId },
    data: {
      config: parsedConfig,
      remotionId: 'Universal',
    },
  })

  revalidatePath(`/dashboard/templates/${parsedId}`)
}

export async function toggleTemplateAssets(templateId: string, useBrandAssets: boolean) {
  await checkAuth()
  const { templateId: parsedId, useBrandAssets: parsedUse } = ToggleTemplateAssetsSchema.parse({
    templateId,
    useBrandAssets,
  })

  await prisma.template.update({
    where: { id: parsedId },
    data: { useBrandAssets: parsedUse },
  })
  revalidatePath(`/dashboard/templates/${parsedId}`)
}

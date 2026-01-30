'use server'

import { prisma } from '@/modules/shared/prisma'
import { revalidatePath } from 'next/cache'
import { checkAuth } from '@/modules/shared/actions'
import { z } from 'zod'

// Schemas
const TemplateFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  remotionId: z.string().min(1, 'Remotion ID is required'),
  airtableTableId: z.string().optional().nullable().transform(val => val || null),
  accountId: z.string().optional().nullable().transform(val => val || null),
})

const IdSchema = z.string().min(1)

const SaveConfigSchema = z.object({
  config: z.unknown(),
})

const ToggleTemplateAssetsSchema = z.object({
  templateId: z.string().min(1),
  useAccountAssets: z.boolean(),
})

export async function addTemplate(formData: FormData) {
  await checkAuth()

  const rawData = {
    name: formData.get('name'),
    remotionId: formData.get('remotionId'),
    airtableTableId: formData.get('airtableTableId'),
    accountId: formData.get('accountId'),
  }

  const data = TemplateFormSchema.parse(rawData)

  await prisma.template.create({
    data,
  })

  revalidatePath('/dashboard/templates')
}

export async function deleteTemplate(id: string) {
  await checkAuth()
  const parsedId = IdSchema.parse(id)

  await prisma.template.delete({
    where: { id: parsedId },
  })

  revalidatePath('/dashboard/templates')
}

export async function updateTemplate(id: string, formData: FormData) {
  await checkAuth()
  const parsedId = IdSchema.parse(id)

  const rawData = {
    name: formData.get('name'),
    remotionId: formData.get('remotionId'),
    airtableTableId: formData.get('airtableTableId'),
    accountId: formData.get('accountId'),
  }

  const data = TemplateFormSchema.parse(rawData)

  await prisma.template.update({
    where: { id: parsedId },
    data,
  })

  revalidatePath('/dashboard/templates')
  revalidatePath(`/dashboard/templates/${parsedId}`)
}

export async function duplicateTemplate(id: string) {
  await checkAuth()
  const parsedId = IdSchema.parse(id)

  const template = await prisma.template.findUnique({ where: { id: parsedId } })
  if (!template) throw new Error('Template not found')

  await prisma.template.create({
    data: {
      name: `${template.name} (Copy)`,
      remotionId: template.remotionId,
      airtableTableId: template.airtableTableId,
      accountId: template.accountId,
      useAccountAssets: template.useAccountAssets,
    },
  })

  revalidatePath('/dashboard/templates')
}

export async function saveTemplateConfig(id: string, config: unknown) {
  await checkAuth()
  const parsedId = IdSchema.parse(id)
  const { config: parsedConfig } = SaveConfigSchema.parse({ config })

  await prisma.template.update({
    where: { id: parsedId },
    data: {
      config: parsedConfig as any,
      remotionId: 'Universal',
    },
  })

  revalidatePath(`/dashboard/templates/${parsedId}`)
}

export async function toggleTemplateAssets(templateId: string, useAccountAssets: boolean) {
  await checkAuth()
  const { templateId: parsedId, useAccountAssets: parsedUse } = ToggleTemplateAssetsSchema.parse({
    templateId,
    useAccountAssets,
  })

  await prisma.template.update({
    where: { id: parsedId },
    data: { useAccountAssets: parsedUse },
  })
  revalidatePath(`/dashboard/templates/${parsedId}`)
}

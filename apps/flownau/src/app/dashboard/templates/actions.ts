'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
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
  config: z.unknown(), // safer than any
})

// Auth Helper
async function checkAuth() {
  const session = await auth()
  if (!session?.user) {
    throw new Error('Unauthorized')
  }
  return session
}

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

  // Current logic overrides remotionId to 'Universal' ? keeping as is per original code
  // Wait, original code: remotionId: 'Universal'. This seems intentional?
  // "Universal" might be a magic string for configurable templates.

  await prisma.template.update({
    where: { id: parsedId },
    data: {
      config: parsedConfig as any, // Json type in Prisma
      remotionId: 'Universal',
    },
  })

  revalidatePath(`/dashboard/templates/${parsedId}`)
}

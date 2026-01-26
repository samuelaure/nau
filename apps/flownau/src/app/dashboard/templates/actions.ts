'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function addTemplate(formData: FormData) {
  const name = formData.get('name') as string
  const remotionId = formData.get('remotionId') as string
  const airtableTableId = formData.get('airtableTableId') as string
  const accountId = formData.get('accountId') as string

  if (!name || !remotionId) {
    throw new Error('Name and Remotion ID are required')
  }

  await prisma.template.create({
    data: {
      name,
      remotionId,
      airtableTableId: airtableTableId || null,
      accountId: accountId || null,
    },
  })

  revalidatePath('/dashboard/templates')
}

export async function deleteTemplate(id: string) {
  if (!id) throw new Error('Missing ID')

  await prisma.template.delete({
    where: { id },
  })

  revalidatePath('/dashboard/templates')
}

export async function updateTemplate(id: string, formData: FormData) {
  const name = formData.get('name') as string
  const remotionId = formData.get('remotionId') as string
  const airtableTableId = formData.get('airtableTableId') as string
  const accountId = formData.get('accountId') as string

  if (!id || !name || !remotionId) {
    throw new Error('Missing required fields')
  }

  await prisma.template.update({
    where: { id },
    data: {
      name,
      remotionId,
      airtableTableId: airtableTableId || null,
      accountId: accountId || null,
    },
  })

  revalidatePath('/dashboard/templates')
  revalidatePath(`/dashboard/templates/${id}`)
}

export async function duplicateTemplate(id: string) {
  const template = await prisma.template.findUnique({ where: { id } })
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

export async function saveTemplateConfig(id: string, config: any) {
  if (!id) throw new Error('Missing ID')

  await prisma.template.update({
    where: { id },
    data: {
      config,
      remotionId: 'Universal',
    },
  })

  revalidatePath(`/dashboard/templates/${id}`)
}

'use server'

import { prisma } from '@/lib/prisma'
import { r2, R2_BUCKET } from '@/lib/r2'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { revalidatePath } from 'next/cache'

export async function deleteAsset(assetId: string) {
  const asset = await prisma.asset.findUnique({ where: { id: assetId } })
  if (!asset) return

  // Delete from R2
  try {
    await r2.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET,
        Key: asset.r2Key,
      }),
    )
  } catch (e) {
    console.error('Failed to delete from R2', e)
  }

  // Delete from DB
  await prisma.asset.delete({ where: { id: assetId } })

  // Revalidate paths
  if (asset.accountId) revalidatePath(`/dashboard/accounts/${asset.accountId}`)
  if (asset.templateId) revalidatePath(`/dashboard/templates/${asset.templateId}`)
}

export async function toggleTemplateAssets(templateId: string, useAccountAssets: boolean) {
  await prisma.template.update({
    where: { id: templateId },
    data: { useAccountAssets },
  })
  revalidatePath(`/dashboard/templates/${templateId}`)
}

'use server'

import { prisma } from '@/modules/shared/prisma'
import { r2, R2_BUCKET } from '@/modules/shared/r2'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth'
import { z } from 'zod'

export async function checkAuth() {
  const user = await requireAuth()
  const workspaces = await prisma.workspaceUser.findMany({
    where: { platformUserId: user.id },
    select: { workspaceId: true },
  })
  return { user: { ...user, workspaces } }
}

export async function checkAccountAccess(accountId: string) {
  const { user } = await checkAuth()
  const workspaceIds = user.workspaces.map((w) => w.workspaceId)

  const account = await prisma.socialAccount.findFirst({
    where: { id: accountId, workspaceId: { in: workspaceIds } },
  })

  if (!account) throw new Error('Forbidden')

  return { account, user }
}

export async function getUserPrimaryWorkspace() {
  const { user } = await checkAuth()

  const wu = await prisma.workspaceUser.findFirst({
    where: { platformUserId: user.id, role: 'owner' },
    select: { workspaceId: true },
  })

  if (!wu) throw new Error('No workspace found for user')

  return { workspaceId: wu.workspaceId, user }
}

const DeleteAssetSchema = z.string().min(1)

export async function deleteAsset(assetId: string) {
  await checkAuth()
  const parsedId = DeleteAssetSchema.parse(assetId)

  const asset = await prisma.asset.findUnique({ where: { id: parsedId } })
  if (!asset) return

  try {
    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: asset.r2Key }))
  } catch (e) {
    console.error('Failed to delete from R2', e)
  }

  await prisma.asset.delete({ where: { id: parsedId } })

  if (asset.accountId) revalidatePath(`/dashboard/accounts/${asset.accountId}`)
  if (asset.templateId) revalidatePath(`/dashboard/templates/${asset.templateId}`)
}

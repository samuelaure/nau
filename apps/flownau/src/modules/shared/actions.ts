'use server'

import { prisma } from '@/modules/shared/prisma'
import { r2, R2_BUCKET } from '@/modules/shared/r2'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { z } from 'zod'

export async function checkAuth() {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      workspaces: { select: { workspaceId: true } },
    },
  })

  if (!user) {
    throw new Error('User not found')
  }

  return { user }
}

/**
 * Verify that the calling user has access to the account via their workspace membership.
 * Returns the account if authorised, throws if not.
 */
export async function checkAccountAccess(accountId: string) {
  const { user } = await checkAuth()
  const workspaceIds = user.workspaces.map((w) => w.workspaceId)

  const account = await prisma.socialAccount.findFirst({
    where: { id: accountId, workspaceId: { in: workspaceIds } },
  })

  if (!account) {
    throw new Error('Forbidden')
  }

  return { account, user }
}

/**
 * Return the first workspace owned by the calling user, or throw if none exists.
 */
export async function getUserPrimaryWorkspace() {
  const { user } = await checkAuth()

  const wu = await prisma.workspaceUser.findFirst({
    where: { userId: user.id, role: 'owner' },
    select: { workspaceId: true },
  })

  if (!wu) {
    throw new Error('No workspace found for user')
  }

  return { workspaceId: wu.workspaceId, user }
}

const DeleteAssetSchema = z.string().min(1)

export async function deleteAsset(assetId: string) {
  await checkAuth()
  const parsedId = DeleteAssetSchema.parse(assetId)

  const asset = await prisma.asset.findUnique({ where: { id: parsedId } })
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
  await prisma.asset.delete({ where: { id: parsedId } })

  // Revalidate paths
  if (asset.accountId) revalidatePath(`/dashboard/accounts/${asset.accountId}`)
  if (asset.templateId) revalidatePath(`/dashboard/templates/${asset.templateId}`)
}

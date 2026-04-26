'use server'

import { prisma } from '@/modules/shared/prisma'
import { storage } from '@/modules/shared/r2'
import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { COOKIE_ACCESS_TOKEN } from '@nau/auth'

export async function checkAuth() {
  const user = await requireAuth()
  return { user }
}

/** Fetch the user's workspaces from 9nau-api using the session JWT. */
export async function getNauWorkspaces() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_ACCESS_TOKEN)?.value
  if (!token) return []

  const nauApiUrl = process.env.NAU_API_URL ?? 'http://9nau-api:3000'
  try {
    const res = await fetch(`${nauApiUrl}/workspaces`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return []
    return res.json() as Promise<
      { id: string; name: string; role: string; brands: { id: string; name: string }[] }[]
    >
  } catch {
    return []
  }
}

/** Returns the first workspace the user owns from 9nau-api. */
export async function getUserPrimaryWorkspace() {
  const { user } = await checkAuth()
  const workspaces = await getNauWorkspaces()
  const primary = workspaces.find((w) => w.role === 'OWNER') ?? workspaces[0]
  if (!primary) throw new Error('No workspace found for user')
  return { workspaceId: primary.id, user }
}

export async function checkBrandAccess(brandId: string) {
  const { user } = await checkAuth()
  const workspaces = await getNauWorkspaces()
  const workspaceIds = workspaces.map((w) => w.id)

  const brand = await prisma.brand.findFirst({
    where: { id: brandId, workspaceId: { in: workspaceIds } },
  })

  if (!brand) throw new Error('Forbidden')

  return { brand, user }
}

const DeleteAssetSchema = z.string().min(1)

export async function deleteAsset(assetId: string) {
  await checkAuth()
  const parsedId = DeleteAssetSchema.parse(assetId)

  const asset = await prisma.asset.findUnique({ where: { id: parsedId } })
  if (!asset) return

  try {
    await storage.delete(asset.r2Key)
  } catch (e) {
    console.error('Failed to delete from R2', e)
  }

  await prisma.asset.delete({ where: { id: parsedId } })

  if (asset.brandId) revalidatePath(`/dashboard/workspace`)
  if (asset.templateId) revalidatePath(`/dashboard/templates/${asset.templateId}`)
}

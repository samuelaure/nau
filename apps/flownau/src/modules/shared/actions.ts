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
    return { user: { ...session.user, id: session.user.id } }
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

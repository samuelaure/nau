import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { r2, R2_BUCKET, R2_PUBLIC_URL } from '@/modules/shared/r2'
import { ListObjectsV2Command } from '@aws-sdk/client-s3'

export async function POST(req: NextRequest) {
    try {
        const { prefix, accountId, templateId } = await req.json()

        if (!prefix || (!accountId && !templateId)) {
            return NextResponse.json({ error: 'Missing prefix or context' }, { status: 400 })
        }

        // List all objects in the prefix (recursively by not using delimiter)
        const command = new ListObjectsV2Command({
            Bucket: R2_BUCKET,
            Prefix: prefix,
        })

        const response = await r2.send(command)
        const objects = response.Contents || []

        const createdAssets = []

        for (const obj of objects) {
            if (!obj.Key || obj.Key.endsWith('/')) continue

            // Determine type from extension
            const ext = obj.Key.split('.').pop()?.toLowerCase()
            let type: 'VID' | 'AUD' | 'IMG' | null = null
            let mimeType = ''

            if (['mp4', 'mov', 'webm'].includes(ext || '')) {
                type = 'VID'
                mimeType = `video/${ext === 'mov' ? 'quicktime' : ext}`
            } else if (['mp3', 'wav', 'm4a', 'aac'].includes(ext || '')) {
                type = 'AUD'
                mimeType = `audio/${ext === 'm4a' ? 'mp4' : ext}`
            } else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
                type = 'IMG'
                mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`
            }

            if (!type) continue

            // Check if already exists for this context
            const existing = await prisma.asset.findFirst({
                where: {
                    r2Key: obj.Key,
                    accountId: accountId || null,
                    templateId: templateId || null,
                },
            })

            if (existing) continue

            const publicUrl = R2_PUBLIC_URL
                ? `${R2_PUBLIC_URL}/${obj.Key}`
                : `https://${R2_BUCKET}.r2.cloudflarestorage.com/${obj.Key}`

            const filename = obj.Key.split('/').pop() || obj.Key

            const asset = await prisma.asset.create({
                data: {
                    accountId: accountId || null,
                    templateId: templateId || null,
                    originalFilename: filename,
                    systemFilename: filename,
                    r2Key: obj.Key,
                    size: obj.Size || 0,
                    mimeType,
                    type,
                    url: publicUrl,
                },
            })
            createdAssets.push(asset)
        }

        // 9. Update Context with assetsRoot
        if (accountId) {
            await prisma.socialAccount.update({
                where: { id: accountId },
                data: { assetsRoot: prefix }
            })
        } else if (templateId) {
            await prisma.template.update({
                where: { id: templateId },
                data: { assetsRoot: prefix }
            })
        }

        return NextResponse.json({ success: true, count: createdAssets.length })
    } catch (error: any) {
        console.error('Failed to link R2 folder', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

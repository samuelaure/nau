import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { r2, R2_BUCKET, R2_PUBLIC_URL } from '@/modules/shared/r2'
import { ListObjectsV2Command } from '@aws-sdk/client-s3'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { prefix, accountId, templateId } = await req.json()

    if (!prefix || (!accountId && !templateId)) {
      return NextResponse.json({ error: 'Missing prefix or context' }, { status: 400 })
    }

    // Purge existing assets to ensure the new folder is the absolute source of truth
    if (accountId) {
      await prisma.asset.deleteMany({ where: { accountId } })
    } else if (templateId) {
      await prisma.asset.deleteMany({ where: { templateId } })
    }

    // List all objects in the prefix (recursively by not using delimiter)
    const command = new ListObjectsV2Command({
      Bucket: R2_BUCKET,
      Prefix: prefix,
    })

    const response = await r2.send(command)
    const objects = response.Contents || []

    // 1. Map all objects for quick lookup (filter out undefined keys)
    const objectMap = new Map(
      objects
        .filter((obj) => obj.Key)
        .map((obj) => [obj.Key!, obj] as [string, (typeof objects)[0]]),
    )

    const createdAssets = []

    // 2. Filter out objects and classify
    const filesToProcess = objects.filter((obj) => {
      if (!obj.Key || obj.Key.endsWith('/')) return false
      const lowerKey = obj.Key.toLowerCase()
      if (lowerKey.includes('/outputs/')) return false
      // Skip thumbnails from being standalone assets if they are in a thumbnails folder
      if (lowerKey.includes('/thumbnails/')) return false
      return true
    })

    for (const obj of filesToProcess) {
      if (!obj.Key) continue
      const ext = obj.Key.split('.').pop()?.toLowerCase() || ''
      let type: 'VID' | 'AUD' | 'IMG' | null = null
      let mimeType = ''

      if (['mp4', 'mov', 'webm'].includes(ext)) {
        type = 'VID'
        mimeType = `video/${ext === 'mov' ? 'quicktime' : ext}`
      } else if (['mp3', 'wav', 'm4a', 'aac'].includes(ext)) {
        type = 'AUD'
        mimeType = `audio/${ext === 'm4a' ? 'mp4' : ext}`
      } else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
        // Only treat as standalone image if it doesn't look like a thumbnail for a video
        // We'll check this by seeing if a corresponding video exists
        const baseName = obj.Key.substring(0, obj.Key.lastIndexOf('.'))
        const hasMatchingVideo = ['mp4', 'mov', 'webm'].some((vExt) =>
          objectMap.has(`${baseName}.${vExt}`),
        )
        if (hasMatchingVideo) continue // Skip as it's likely a thumbnail

        type = 'IMG'
        mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`
      }

      if (!type) continue

      // Look for a potential thumbnail for videos
      let thumbnailUrl: string | null = null
      if (type === 'VID') {
        const baseName = obj.Key.substring(0, obj.Key.lastIndexOf('.'))
        const fileOnly = obj.Key.split('/').pop() || ''
        const baseOnly = fileOnly.substring(0, fileOnly.lastIndexOf('.'))
        const pathOnly = obj.Key.substring(0, obj.Key.lastIndexOf('/'))

        const possibleThumbExtensions = ['jpg', 'jpeg', 'png', 'webp']
        for (const tExt of possibleThumbExtensions) {
          // Check same folder: video.mp4 -> video.jpg
          const sameFolderKey = `${baseName}.${tExt}`
          // Check thumbnails folder: videos/video.mp4 -> thumbnails/video.jpg
          // This assumes the thumbnails folder is at the same level as the video's parent or in a specific place
          // But based on user description "videos, thumbnails, audios", they are siblings.
          const thumbnailsFolderKey = obj.Key.replace(
            /\/[^/]+\/[^/]+$/,
            `/thumbnails/${baseOnly}.${tExt}`,
          )
          // Also check a more direct sibling approach: prefix/thumbnails/filename.jpg
          const directSiblingThumb = prefix.endsWith('/')
            ? `${prefix}thumbnails/${baseOnly}.${tExt}`
            : `${prefix}/thumbnails/${baseOnly}.${tExt}`

          const thumbKey = objectMap.has(sameFolderKey)
            ? sameFolderKey
            : objectMap.has(directSiblingThumb)
              ? directSiblingThumb
              : objectMap.has(thumbnailsFolderKey)
                ? thumbnailsFolderKey
                : null

          if (thumbKey) {
            thumbnailUrl = R2_PUBLIC_URL
              ? `${R2_PUBLIC_URL}/${thumbKey}`
              : `https://${R2_BUCKET}.r2.cloudflarestorage.com/${thumbKey}`
            break
          }
        }
      }

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
          thumbnailUrl,
        },
      })
      createdAssets.push(asset)
    }

    // 9. Update Context with assetsRoot
    if (accountId) {
      await prisma.socialAccount.update({
        where: { id: accountId },
        data: { assetsRoot: prefix },
      })
    } else if (templateId) {
      await prisma.template.update({
        where: { id: templateId },
        data: { assetsRoot: prefix },
      })
    }

    return NextResponse.json({ success: true, count: createdAssets.length })
  } catch (error: unknown) {
    console.error('Failed to link R2 folder', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { storage } from '@/modules/shared/r2'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { prefix, accountId, templateId } = await req.json()

    if (!prefix || (!accountId && !templateId)) {
      return NextResponse.json({ error: 'Missing prefix or context' }, { status: 400 })
    }

    // Purge existing assets so the new folder is the absolute source of truth
    if (accountId) {
      await prisma.asset.deleteMany({ where: { accountId } })
    } else if (templateId) {
      await prisma.asset.deleteMany({ where: { templateId } })
    }

    // List all objects in the prefix recursively
    const objects = await storage.listAll(prefix)

    // Map all keys for quick thumbnail lookup
    const keySet = new Set(objects.map((o) => o.key))

    const createdAssets = []

    const filesToProcess = objects.filter((obj) => {
      if (obj.key.endsWith('/')) return false
      const lower = obj.key.toLowerCase()
      if (lower.includes('/outputs/')) return false
      if (lower.includes('/thumbnails/')) return false
      return true
    })

    for (const obj of filesToProcess) {
      const ext = obj.key.split('.').pop()?.toLowerCase() || ''
      let type: 'VID' | 'AUD' | 'IMG' | null = null
      let mimeType = ''

      if (['mp4', 'mov', 'webm'].includes(ext)) {
        type = 'VID'
        mimeType = `video/${ext === 'mov' ? 'quicktime' : ext}`
      } else if (['mp3', 'wav', 'm4a', 'aac'].includes(ext)) {
        type = 'AUD'
        mimeType = `audio/${ext === 'm4a' ? 'mp4' : ext}`
      } else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
        // Skip if a matching video exists (it's a thumbnail)
        const baseName = obj.key.substring(0, obj.key.lastIndexOf('.'))
        const hasMatchingVideo = ['mp4', 'mov', 'webm'].some((vExt) => keySet.has(`${baseName}.${vExt}`))
        if (hasMatchingVideo) continue

        type = 'IMG'
        mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`
      }

      if (!type) continue

      // Look for a thumbnail for videos
      let thumbnailUrl: string | null = null
      if (type === 'VID') {
        const baseName = obj.key.substring(0, obj.key.lastIndexOf('.'))
        const fileOnly = obj.key.split('/').pop() || ''
        const baseOnly = fileOnly.substring(0, fileOnly.lastIndexOf('.'))
        const thumbInSiblingFolder = prefix.endsWith('/')
          ? `${prefix}thumbnails/${baseOnly}.jpg`
          : `${prefix}/thumbnails/${baseOnly}.jpg`
        const thumbSameFolder = `${baseName}.jpg`

        const thumbKey = keySet.has(thumbSameFolder)
          ? thumbSameFolder
          : keySet.has(thumbInSiblingFolder)
            ? thumbInSiblingFolder
            : null

        if (thumbKey) {
          thumbnailUrl = storage.cdnUrl(thumbKey)
        }
      }

      const publicUrl = storage.cdnUrl(obj.key)
      const filename = obj.key.split('/').pop() || obj.key

      const asset = await prisma.asset.create({
        data: {
          accountId: accountId || null,
          templateId: templateId || null,
          originalFilename: filename,
          systemFilename: filename,
          r2Key: obj.key,
          size: obj.size,
          mimeType,
          type,
          url: publicUrl,
          thumbnailUrl,
        },
      })
      createdAssets.push(asset)
    }

    // Update context with assetsRoot
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

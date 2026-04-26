import { prisma } from '@/modules/shared/prisma'
import { storage } from '@/modules/shared/r2'
import path from 'path'

function getMimeType(key: string): string {
  const ext = path.extname(key).toLowerCase()
  switch (ext) {
    case '.mp4':
      return 'video/mp4'
    case '.mov':
      return 'video/quicktime'
    case '.mp3':
      return 'audio/mpeg'
    case '.wav':
      return 'audio/wav'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    default:
      return 'application/octet-stream'
  }
}

function getAssetType(key: string): 'VID' | 'AUD' | 'IMG' | 'UNK' {
  const mime = getMimeType(key)
  if (mime.startsWith('video/')) return 'VID'
  if (mime.startsWith('audio/')) return 'AUD'
  if (mime.startsWith('image/')) return 'IMG'
  return 'UNK'
}

export async function syncR2Assets() {
  const logs: string[] = []
  const log = (msg: string) => logs.push(msg)

  try {
    log('Fetching accounts...')
    const accounts = await prisma.socialProfile.findMany()

    // brandId-keyed map for fast lookup
    const accountIds = new Set(accounts.map((a) => a.id))

    // List only flownau's prefix to avoid touching nauthenticity or 9nau objects
    log('Listing R2 objects under flownau/...')
    const allObjects = await storage.listAll('flownau/')

    const allR2Keys = new Set(allObjects.map((o) => o.key))
    log(`R2 listing complete. Found ${allR2Keys.size} objects.`)

    for (const obj of allObjects) {
      await syncObject(obj.key, obj.size, accountIds, log)
    }

    await cleanupOrphans(allR2Keys, log)

    return { success: true, logs }
  } catch (error: unknown) {
    console.error('Sync failed', error)
    return { success: false, error: (error as Error).message, logs }
  }
}

async function syncObject(
  key: string,
  size: number,
  accountIds: Set<string>,
  log: (m: string) => void,
) {
  const filename = key.split('/').pop() || ''
  if (filename === '.DS_Store' || filename === '') return

  // Key schema: flownau/accounts/{brandId}/assets/{type}/{file}
  //             flownau/accounts/{brandId}/outputs/{file}
  //             flownau/templates/{templateId}/assets/{file}
  // Skip thumbnails and output files as standalone assets
  if (key.includes('/thumbnails/') || key.includes('/outputs/')) return

  const parts = key.split('/')
  let brandId: string | undefined
  let templateId: string | undefined

  if (parts[1] === 'accounts' && parts[2]) {
    brandId = accountIds.has(parts[2]) ? parts[2] : undefined
  } else if (parts[1] === 'templates' && parts[2]) {
    templateId = parts[2]
  } else {
    return
  }

  const mimeType = getMimeType(key)
  const type = getAssetType(key)
  const url = storage.cdnUrl(key)

  const existing = await prisma.asset.findFirst({ where: { r2Key: key } })

  if (existing) {
    if (existing.size !== size || existing.url !== url || existing.type !== type) {
      await prisma.asset.update({
        where: { id: existing.id },
        data: { size, url, mimeType, type },
      })
    }
    if (!existing.brandId && brandId) {
      log(`Linking orphan asset ${key} to account ${brandId}`)
      await prisma.asset.update({ where: { id: existing.id }, data: { brandId } })
    }
  } else {
    log(`Creating new asset: ${key}`)
    await prisma.asset.create({
      data: {
        r2Key: key,
        url,
        size,
        mimeType,
        type,
        systemFilename: filename,
        originalFilename: filename,
        brandId: brandId ?? null,
        templateId: templateId ?? null,
      },
    })
  }
}

async function cleanupOrphans(validKeys: Set<string>, log: (m: string) => void) {
  const allAssets = await prisma.asset.findMany({ select: { id: true, r2Key: true } })

  let removed = 0
  for (const asset of allAssets) {
    if (!validKeys.has(asset.r2Key)) {
      await prisma.asset.delete({ where: { id: asset.id } })
      removed++
    }
  }
  if (removed > 0) log(`Removed ${removed} orphaned DB records.`)
}

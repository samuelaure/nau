'use server'

import { prisma } from '@/lib/prisma'
import { r2, R2_BUCKET } from '@/lib/r2'
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { revalidatePath } from 'next/cache'

const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska']
const AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/aac', 'audio/ogg', 'audio/x-m4a']

function getExtension(filename: string) {
  return filename.split('.').pop()?.toLowerCase() || ''
}

async function getNextSystemFilename(
  accountId: string,
  type: 'VID' | 'AUD' | 'IMG',
  shortCode: string,
  ext: string,
) {
  // Find last asset to determine counter
  // Pattern: SHORTCODE_TYPE_XXXX.ext
  const prefix = `${shortCode}_${type}_`

  const lastAsset = await prisma.asset.findFirst({
    where: {
      accountId,
      systemFilename: { startsWith: prefix },
    },
    orderBy: { systemFilename: 'desc' },
  })

  let counter = 1
  if (lastAsset) {
    // Extract number
    const parts = lastAsset.systemFilename.split('_')
    const numPart = parts.length > 2 ? parts[2].split('.')[0] : null
    if (numPart && !isNaN(parseInt(numPart))) {
      counter = parseInt(numPart) + 1
    }
  }

  return `${prefix}${counter.toString().padStart(4, '0')}.${ext}`
}

export async function prepareUpload(
  accountId: string,
  filename: string,
  size: number,
  contentType: string,
  hash?: string,
) {
  const account = await prisma.socialAccount.findUnique({ where: { id: accountId } })
  if (!account) throw new Error('Account not found')

  // Check duplicate hash
  if (hash) {
    const existing = await prisma.asset.findFirst({
      where: { accountId, hash },
    })
    if (existing) {
      return { error: 'Duplicate file', existing }
    }
  }

  // Determine Type
  let type: 'VID' | 'AUD' | 'IMG' = 'IMG'
  if (VIDEO_TYPES.includes(contentType)) type = 'VID'
  else if (AUDIO_TYPES.includes(contentType)) type = 'AUD'
  else if (contentType.startsWith('image/')) type = 'IMG'
  else throw new Error('Unsupported file type')

  // Ensure ShortCode
  let shortCode = account.shortCode
  if (!shortCode && account.username) {
    shortCode = account.username.substring(0, 2).toUpperCase()
    // Update account
    await prisma.socialAccount.update({
      where: { id: accountId },
      data: { shortCode },
    })
  } else if (!shortCode) {
    shortCode = 'XX'
  }

  // Generate Key
  const ext = getExtension(filename)
  const systemFilename = await getNextSystemFilename(accountId, type, shortCode!, ext)

  // Folder structure: PROJECT/videos/FILENAME
  const folder = type === 'VID' ? 'videos' : type === 'AUD' ? 'audios' : 'images'
  // Use username or shortCode as project folder? butler.js uses project name.
  // We'll use username or unique ID. Username is friendlier but mutable.
  // Let's use username if available, else ID.
  const projectFolder = account.username || account.id
  const r2Key = `${projectFolder}/${folder}/${systemFilename}`

  // Get Signed URL
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: r2Key,
    ContentType: contentType,
    ContentLength: size,
  })

  const url = await getSignedUrl(r2, command, { expiresIn: 600 }) // 10 minutes

  return { url, r2Key, systemFilename, type }
}

export async function confirmUpload(
  accountId: string,
  assetData: {
    originalFilename: string
    systemFilename: string
    r2Key: string
    size: number
    mimeType: string
    hash: string
    type: string
  },
) {
  // Verify R2 public URL base
  const publicUrl = process.env.R2_PUBLIC_URL
    ? `${process.env.R2_PUBLIC_URL}/${assetData.r2Key}`
    : `https://${R2_BUCKET}.r2.cloudflarestorage.com/${assetData.r2Key}` // Fallback, likely won't work without custom domain usually

  await prisma.asset.create({
    data: {
      accountId,
      originalFilename: assetData.originalFilename,
      systemFilename: assetData.systemFilename,
      r2Key: assetData.r2Key,
      size: assetData.size,
      mimeType: assetData.mimeType,
      hash: assetData.hash,
      type: assetData.type,
      url: publicUrl,
    },
  })

  revalidatePath(`/dashboard/accounts/${accountId}`)
}

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
  revalidatePath(`/dashboard/accounts/${asset.accountId}`)
}

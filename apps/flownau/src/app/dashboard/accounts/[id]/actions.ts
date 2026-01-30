'use server'

import { prisma } from '@/lib/prisma'
import { r2, R2_BUCKET } from '@/lib/r2'
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { z } from 'zod'

const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska']
const AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/aac', 'audio/ogg', 'audio/x-m4a']

const PrepareUploadSchema = z.object({
  accountId: z.string().min(1),
  filename: z.string().min(1),
  size: z.number().positive(),
  contentType: z.string().min(1),
  hash: z.string().optional(),
})

const ConfirmUploadSchema = z.object({
  accountId: z.string().min(1),
  assetData: z.object({
    originalFilename: z.string(),
    systemFilename: z.string(),
    r2Key: z.string(),
    size: z.number(),
    mimeType: z.string(),
    hash: z.string(),
    type: z.string(),
    // add validation for type enum if needed
  })
})

const IdSchema = z.string().min(1)

async function checkAuth() {
  const session = await auth()
  if (!session?.user) {
    throw new Error('Unauthorized')
  }
}

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
  await checkAuth()
  const params = PrepareUploadSchema.parse({ accountId, filename, size, contentType, hash })

  const account = await prisma.socialAccount.findUnique({ where: { id: params.accountId } })
  if (!account) throw new Error('Account not found')

  // Check duplicate hash
  if (params.hash) {
    const existing = await prisma.asset.findFirst({
      where: { accountId: params.accountId, hash: params.hash },
    })
    if (existing) {
      return { error: 'Duplicate file', existing }
    }
  }

  // Determine Type
  let type: 'VID' | 'AUD' | 'IMG' = 'IMG'
  if (VIDEO_TYPES.includes(params.contentType)) type = 'VID'
  else if (AUDIO_TYPES.includes(params.contentType)) type = 'AUD'
  else if (params.contentType.startsWith('image/')) type = 'IMG'
  else throw new Error('Unsupported file type')

  // Ensure ShortCode
  let shortCode = account.shortCode
  if (!shortCode && account.username) {
    shortCode = account.username.substring(0, 2).toUpperCase()
    // Update account
    await prisma.socialAccount.update({
      where: { id: params.accountId },
      data: { shortCode },
    })
  } else if (!shortCode) {
    shortCode = 'XX'
  }

  // Generate Key
  const ext = getExtension(params.filename)
  const systemFilename = await getNextSystemFilename(params.accountId, type, shortCode!, ext)

  // Folder structure: PROJECT/videos/FILENAME
  const folder = type === 'VID' ? 'videos' : type === 'AUD' ? 'audios' : 'images'
  const projectFolder = account.username || account.id
  const r2Key = `${projectFolder}/${folder}/${systemFilename}`

  // Get Signed URL
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: r2Key,
    ContentType: params.contentType,
    ContentLength: params.size,
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
  await checkAuth()
  const params = ConfirmUploadSchema.parse({ accountId, assetData })

  // Verify R2 public URL base
  const publicUrl = process.env.R2_PUBLIC_URL
    ? `${process.env.R2_PUBLIC_URL}/${params.assetData.r2Key}`
    : `https://${R2_BUCKET}.r2.cloudflarestorage.com/${params.assetData.r2Key}`

  await prisma.asset.create({
    data: {
      accountId: params.accountId,
      originalFilename: params.assetData.originalFilename,
      systemFilename: params.assetData.systemFilename,
      r2Key: params.assetData.r2Key,
      size: params.assetData.size,
      mimeType: params.assetData.mimeType,
      hash: params.assetData.hash,
      type: params.assetData.type,
      url: publicUrl,
    },
  })

  revalidatePath(`/dashboard/accounts/${params.accountId}`)
}

export async function deleteAsset(assetId: string) {
  await checkAuth()
  const parsedId = IdSchema.parse(assetId)

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
  revalidatePath(`/dashboard/accounts/${asset.accountId}`)
}

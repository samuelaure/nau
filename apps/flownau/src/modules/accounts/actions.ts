'use server'

import { prisma } from '@/modules/shared/prisma'
import { r2, R2_BUCKET } from '@/modules/shared/r2'
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { revalidatePath } from 'next/cache'
import { ApifyService } from '@/modules/accounts/apify'
import { downloadAndUploadProfileImage } from '@/modules/accounts/profile-image-service'
import { checkAuth } from '@/modules/shared/actions'
import { z } from 'zod'

// --- HELPER SCHEMAS ---
const AccountSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  accessToken: z.string().min(1, 'Access Token is required'),
  platformId: z.string().min(1, 'Platform ID is required'),
})

const AccountUpdateSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  platformId: z.string().min(1, 'Platform ID is required'),
  accessToken: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform((val) => val || undefined),
})

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
  }),
})

const IdSchema = z.string().min(1)

// --- CONSTANTS ---
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska']
const AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/aac', 'audio/ogg', 'audio/x-m4a']

// --- ACCOUNT ACTIONS ---

export async function addAccount(formData: FormData) {
  const { user } = await checkAuth()

  const rawData = {
    username: formData.get('username'),
    accessToken: formData.get('accessToken'),
    platformId: formData.get('platformId'),
  }

  const data = AccountSchema.parse(rawData)

  const newAccount = await prisma.socialAccount.create({
    data: {
      userId: user.id,
      platform: 'instagram',
      username: data.username,
      accessToken: data.accessToken,
      platformId: data.platformId,
    },
  })

  await syncAccountProfile(newAccount.id)
  revalidatePath('/dashboard/accounts')
}

export async function deleteAccount(id: string) {
  await checkAuth()
  const parsedId = IdSchema.parse(id)

  await prisma.socialAccount.delete({
    where: { id: parsedId },
  })

  revalidatePath('/dashboard/accounts')
}

export async function updateAccount(id: string, formData: FormData) {
  await checkAuth()
  const parsedId = IdSchema.parse(id)

  const rawData = {
    username: formData.get('username'),
    platformId: formData.get('platformId'),
    accessToken: formData.get('accessToken'),
  }

  const { username, platformId, accessToken } = AccountUpdateSchema.parse(rawData)

  const data: any = {
    username,
    platformId,
  }

  if (accessToken) {
    data.accessToken = accessToken
  }

  await prisma.socialAccount.update({
    where: { id: parsedId },
    data,
  })

  await syncAccountProfile(parsedId)

  revalidatePath('/dashboard/accounts')
  revalidatePath(`/dashboard/accounts/${parsedId}`)
}

export async function syncAccountProfile(id: string) {
  await checkAuth()
  const parsedId = IdSchema.parse(id)

  const account = await prisma.socialAccount.findUnique({ where: { id: parsedId } })
  if (!account || !account.username) return

  const result = await ApifyService.fetchProfile(account.username)

  if (result.status === 'success') {
    let finalProfileImage = account.profileImage

    if (result.profileImage) {
      const r2Url = await downloadAndUploadProfileImage(result.profileImage, account.username)
      if (r2Url) {
        finalProfileImage = r2Url
      }
    }

    await prisma.socialAccount.update({
      where: { id: parsedId },
      data: {
        profileImage: finalProfileImage,
        platformId: result.id || account.platformId,
      },
    })
    revalidatePath('/dashboard/accounts')
    revalidatePath(`/dashboard/accounts/${parsedId}`)
  }
}

// --- ASSET ACTIONS ---

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

  if (params.hash) {
    const existing = await prisma.asset.findFirst({
      where: { accountId: params.accountId, hash: params.hash },
    })
    if (existing) {
      return { error: 'Duplicate file', existing }
    }
  }

  let type: 'VID' | 'AUD' | 'IMG' = 'IMG'
  if (VIDEO_TYPES.includes(params.contentType)) type = 'VID'
  else if (AUDIO_TYPES.includes(params.contentType)) type = 'AUD'
  else if (params.contentType.startsWith('image/')) type = 'IMG'
  else throw new Error('Unsupported file type')

  let shortCode = account.shortCode
  if (!shortCode && account.username) {
    shortCode = account.username.substring(0, 2).toUpperCase()
    await prisma.socialAccount.update({
      where: { id: params.accountId },
      data: { shortCode },
    })
  } else if (!shortCode) {
    shortCode = 'XX'
  }

  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const systemFilename = await getNextSystemFilename(params.accountId, type, shortCode!, ext)

  const folder = type === 'VID' ? 'videos' : type === 'AUD' ? 'audios' : 'images'
  const projectFolder = account.username || account.id
  const r2Key = `${projectFolder}/${folder}/${systemFilename}`

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: r2Key,
    ContentType: params.contentType,
    ContentLength: params.size,
  })

  const url = await getSignedUrl(r2, command, { expiresIn: 600 })

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

async function getNextSystemFilename(
  accountId: string,
  type: 'VID' | 'AUD' | 'IMG',
  shortCode: string,
  ext: string,
) {
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
    const parts = lastAsset.systemFilename.split('_')
    const numPart = parts.length > 2 ? parts[2].split('.')[0] : null
    if (numPart && !isNaN(parseInt(numPart))) {
      counter = parseInt(numPart) + 1
    }
  }

  return `${prefix}${counter.toString().padStart(4, '0')}.${ext}`
}

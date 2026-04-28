'use server'

import { prisma } from '@/modules/shared/prisma'
import { storage } from '@/modules/shared/r2'
import { flownau, assetTypeFromMime } from 'nau-storage'
import { revalidatePath } from 'next/cache'
import { ApifyService } from '@/modules/accounts/apify'
import { downloadAndUploadProfileImage } from '@/modules/accounts/profile-image-service'
import { checkAuth, getUserPrimaryWorkspace } from '@/modules/shared/actions'
import {
  DEFAULT_MODEL,
  DEFAULT_PERSONA_NAME,
  DEFAULT_PERSONA_PROMPT,
  DEFAULT_FRAMEWORK_NAME,
  DEFAULT_FRAMEWORK_PROMPT,
  DEFAULT_PRINCIPLES_NAME,
  DEFAULT_PRINCIPLES_PROMPT,
} from '@/modules/shared/pipeline-defaults'
import { z } from 'zod'
import { COOKIE_ACCESS_TOKEN } from '@nau/auth'

const SocialProfileSchema = z.object({
  username: z.string().min(1, 'Username is required').transform((val) => val.replace(/^@/, '')),
  accessToken: z.string().min(1, 'Access Token is required'),
  platformId: z.string().min(1, 'Platform ID is required'),
})

/**
 * Sync a social profile to nauthenticity so it's discoverable from nauthenticity's content section
 */
async function syncToNauthenticity(username: string, profileImageUrl: string | null = null) {
  try {
    const nauthenticityUrl = process.env.NAUTHENTICITY_URL || 'http://localhost:3007'
    const serviceKey = process.env.NAU_SERVICE_KEY || ''

    await fetch(`${nauthenticityUrl}/api/v1/social-profiles/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Nau-Service-Key': serviceKey,
      },
      body: JSON.stringify({
        username,
        platform: 'instagram',
        profileImageUrl,
      }),
    }).catch((err) => {
      // Log but don't fail — sync to nauthenticity is nice-to-have
      console.warn('[SyncToNauthenticity] Failed to sync profile:', err)
    })
  } catch (error) {
    console.warn('[SyncToNauthenticity] Error:', error)
  }
}

const BrandUpdateSchema = z.object({
  directorPrompt: z.string().nullable().optional(),
  creationPrompt: z.string().nullable().optional(),
  shortCode: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  ideationCount: z.coerce.number().int().min(1).max(30).optional().nullable(),
  autoApproveIdeas: z.string().optional().transform((v) => v === 'true'),
})

const SocialProfileUpdateSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  platformId: z.string().min(1, 'Platform ID is required'),
  accessToken: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform((val) => val || undefined),
})

const PrepareUploadSchema = z.object({
  brandId: z.string().min(1),
  filename: z.string().min(1),
  size: z.number().positive(),
  contentType: z.string().min(1),
  hash: z.string().optional(),
})

const ConfirmUploadSchema = z.object({
  brandId: z.string().min(1),
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

const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska']
const AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/aac', 'audio/ogg', 'audio/x-m4a']

// ── Brand actions ──────────────────────────────────────────────────────────────

/** Create a brand in 9naŭ API and upsert a local Brand record in flownau. */
export async function addBrand(formData: FormData): Promise<{ id: string; workspaceId: string }> {
  const explicitWorkspaceId = (formData.get('workspaceId') as string | null) || null
  const { workspaceId: primaryWorkspaceId } = await getUserPrimaryWorkspace()
  const workspaceId = explicitWorkspaceId ?? primaryWorkspaceId
  const name = (formData.get('brandName') as string | null)?.trim()
  if (!name) throw new Error('Brand name is required')

  const cookieStore = await import('next/headers').then((m) => m.cookies())
  const token = cookieStore.get(COOKIE_ACCESS_TOKEN)?.value
  const nauApiUrl = process.env.NAU_API_URL ?? 'http://9nau-api:3000'

  const res = await fetch(`${nauApiUrl}/workspaces/${workspaceId}/brands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to create brand: ${text}`)
  }

  const nauBrand = (await res.json()) as { id: string }

  // Upsert local Brand record so content pipeline can anchor to it
  await prisma.brand.upsert({
    where: { id: nauBrand.id },
    create: { id: nauBrand.id, workspaceId, name },
    update: { name, workspaceId },
  })

  // Seed starter pipeline records so the brand works out of the box.
  // These are real, fully editable records — not system defaults.
  // The user can modify or delete them at any time.
  await Promise.all([
    prisma.brandPersona.create({
      data: {
        brandId: nauBrand.id,
        workspaceId,
        name: DEFAULT_PERSONA_NAME,
        systemPrompt: DEFAULT_PERSONA_PROMPT,
        modelSelection: DEFAULT_MODEL,
        isDefault: true,
        manualCount: 5,
        automaticCount: 5,
        capturedCount: 3,
      },
    }),
    prisma.ideasFramework.create({
      data: {
        brandId: nauBrand.id,
        workspaceId,
        name: DEFAULT_FRAMEWORK_NAME,
        systemPrompt: DEFAULT_FRAMEWORK_PROMPT,
        isDefault: true,
      },
    }),
    prisma.contentCreationPrinciples.create({
      data: {
        brandId: nauBrand.id,
        workspaceId,
        name: DEFAULT_PRINCIPLES_NAME,
        systemPrompt: DEFAULT_PRINCIPLES_PROMPT,
        isDefault: true,
      },
    }),
  ])

  revalidatePath('/dashboard')
  return { id: nauBrand.id, workspaceId }
}

/** Update brand-level pipeline config (prompts, shortCode). */
export async function updateBrand(brandId: string, formData: FormData) {
  await checkAuth()
  const parsedId = IdSchema.parse(brandId)
  const { directorPrompt, creationPrompt, shortCode, language, ideationCount, autoApproveIdeas } = BrandUpdateSchema.parse({
    directorPrompt: formData.get('directorPrompt'),
    creationPrompt: formData.get('creationPrompt'),
    shortCode: formData.get('shortCode'),
    language: formData.get('language'),
    ideationCount: formData.get('ideationCount'),
    autoApproveIdeas: formData.get('autoApproveIdeas'),
  })

  await prisma.brand.update({
    where: { id: parsedId },
    data: {
      directorPrompt: directorPrompt ?? undefined,
      creationPrompt: creationPrompt ?? undefined,
      shortCode: shortCode ?? undefined,
      language: language ?? undefined,
      autoApproveIdeas,
      ...(ideationCount != null && { ideationCount }),
    },
  })

  revalidatePath('/dashboard')
}

/** Move a brand to another workspace (updates both 9naŭ API and local record). */
export async function moveBrandToWorkspace(brandId: string, targetWorkspaceId: string) {
  await checkAuth()
  const parsedId = IdSchema.parse(brandId)
  const parsedWsId = IdSchema.parse(targetWorkspaceId)

  const cookieStore = await import('next/headers').then((m) => m.cookies())
  const token = cookieStore.get(COOKIE_ACCESS_TOKEN)?.value
  const nauApiUrl = process.env.NAU_API_URL ?? 'http://9nau-api:3000'

  const brand = await prisma.brand.findUnique({ where: { id: parsedId } })
  if (!brand) throw new Error('Brand not found')

  if (token) {
    const res = await fetch(
      `${nauApiUrl}/workspaces/${brand.workspaceId}/brands/${parsedId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ workspaceId: parsedWsId }),
      },
    )
    if (!res.ok) console.error(`Failed to move brand in 9naŭ-api: ${await res.text()}`)
  }

  await prisma.brand.update({
    where: { id: parsedId },
    data: { workspaceId: parsedWsId },
  })

  revalidatePath('/dashboard')
}

// ── Social Profile actions ─────────────────────────────────────────────────────

/** Add a social profile (posting channel) to a brand. */
export async function addSocialProfile(formData: FormData) {
  const { workspaceId: primaryWorkspaceId } = await getUserPrimaryWorkspace()
  const workspaceId = (formData.get('workspaceId') as string | null) || primaryWorkspaceId
  const brandId = formData.get('brandId') as string | null
  if (!brandId) throw new Error('brandId is required')

  const data = SocialProfileSchema.parse({
    username: formData.get('username'),
    accessToken: formData.get('accessToken'),
    platformId: formData.get('platformId'),
  })

  // Ensure local Brand record exists
  await prisma.brand.upsert({
    where: { id: brandId },
    create: { id: brandId, workspaceId },
    update: {},
  })

  const profile = await prisma.socialProfile.create({
    data: {
      brandId,
      workspaceId,
      platform: 'instagram',
      username: data.username,
      accessToken: data.accessToken || null,
      platformId: data.platformId,
    },
  })

  // Sync profile to nauthenticity so it's discoverable there
  if (profile.username) await syncToNauthenticity(profile.username, profile.profileImage)

  await syncSocialProfile(profile.id)
  revalidatePath('/dashboard')
}

/** @deprecated Use addSocialProfile */
export const addAccount = addSocialProfile

export async function deleteSocialProfile(id: string) {
  await checkAuth()
  await prisma.socialProfile.delete({ where: { id: IdSchema.parse(id) } })
  revalidatePath('/dashboard')
}

/** @deprecated Use deleteSocialProfile */
export const deleteAccount = deleteSocialProfile

export async function updateSocialProfile(id: string, formData: FormData) {
  await checkAuth()
  const parsedId = IdSchema.parse(id)
  const { username, platformId, accessToken } = SocialProfileUpdateSchema.parse({
    username: formData.get('username'),
    platformId: formData.get('platformId'),
    accessToken: formData.get('accessToken'),
  })

  await prisma.socialProfile.update({
    where: { id: parsedId },
    data: { username, platformId, ...(accessToken ? { accessToken } : {}) },
  })

  await syncSocialProfile(parsedId)
  revalidatePath('/dashboard')
}

export async function syncSocialProfile(id: string) {
  await checkAuth()
  const parsedId = IdSchema.parse(id)

  const profile = await prisma.socialProfile.findUnique({ where: { id: parsedId } })
  if (!profile || !profile.username) return

  const result = await ApifyService.fetchProfile(profile.username)

  if (result.status === 'success') {
    let finalProfileImage = profile.profileImage

    if (result.profileImage) {
      const r2Url = await downloadAndUploadProfileImage(result.profileImage, profile.username)
      if (r2Url) finalProfileImage = r2Url
    }

    await prisma.socialProfile.update({
      where: { id: parsedId },
      data: {
        profileImage: finalProfileImage,
        platformId: result.id || profile.platformId,
      },
    })
    revalidatePath('/dashboard')
  }
}

/** @deprecated Use syncSocialProfile */
export const syncAccountProfile = syncSocialProfile

/**
 * Manually sync a social profile to nauthenticity
 * Useful for profiles created before auto-sync was implemented
 */
export async function syncProfileToNauthenticity(profileId: string) {
  await checkAuth()

  const profile = await prisma.socialProfile.findUnique({
    where: { id: profileId },
    include: { brand: true },
  })

  if (!profile || !profile.username) {
    throw new Error('Profile not found or has no username')
  }

  const nauthenticityUrl = process.env.NAUTHENTICITY_URL || 'http://localhost:3007'
  const serviceKey = process.env.NAU_SERVICE_KEY || ''

  const response = await fetch(`${nauthenticityUrl}/api/v1/social-profiles/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Nau-Service-Key': serviceKey,
    },
    body: JSON.stringify({
      username: profile.username,
      platform: profile.platform || 'instagram',
      profileImageUrl: profile.profileImage,
      brandId: profile.brandId,
      workspaceId: profile.workspaceId,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.message || 'Failed to sync to nauthenticity')
  }

  revalidatePath('/dashboard')
  return { success: true, message: 'Profile synced to nauthenticity' }
}

// ── Asset upload actions ───────────────────────────────────────────────────────

export async function prepareUpload(
  brandId: string,
  filename: string,
  size: number,
  contentType: string,
  hash?: string,
) {
  await checkAuth()
  const params = PrepareUploadSchema.parse({ brandId, filename, size, contentType, hash })

  const brand = await prisma.brand.findUnique({ where: { id: params.brandId } })
  if (!brand) throw new Error('Brand not found')

  if (params.hash) {
    const existing = await prisma.asset.findFirst({
      where: { brandId: params.brandId, hash: params.hash },
    })
    if (existing) return { error: 'Duplicate file', existing }
  }

  let type: 'VID' | 'AUD' | 'IMG' = 'IMG'
  if (VIDEO_TYPES.includes(params.contentType)) type = 'VID'
  else if (AUDIO_TYPES.includes(params.contentType)) type = 'AUD'
  else if (params.contentType.startsWith('image/')) type = 'IMG'
  else throw new Error('Unsupported file type')

  let shortCode = brand.shortCode
  if (!shortCode) {
    shortCode = brand.name?.substring(0, 2).toUpperCase() ?? 'XX'
    await prisma.brand.update({ where: { id: params.brandId }, data: { shortCode } })
  }

  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const systemFilename = await getNextSystemFilename(params.brandId, type, shortCode, ext)
  const assetId = systemFilename.replace(`.${ext}`, '')

  const assetFolder = assetTypeFromMime(params.contentType)
  const r2Key = flownau.accountAsset(params.brandId, assetFolder, assetId, ext)

  const { uploadUrl: url } = await storage.presignUpload(r2Key, params.contentType, 600)

  return { url, r2Key, systemFilename, type }
}

export async function confirmUpload(
  brandId: string,
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
  const params = ConfirmUploadSchema.parse({ brandId, assetData })
  const publicUrl = storage.cdnUrl(params.assetData.r2Key)

  await prisma.asset.create({
    data: {
      brandId: params.brandId,
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

  revalidatePath('/dashboard')
}

export async function installDefaultTemplates(brandId: string): Promise<{ installed: number }> {
  await checkAuth()
  const { seedSystemTemplates, seedTemplatesForBrand } = await import('@/../prisma/seeds/templates')
  await seedSystemTemplates(prisma)
  await seedTemplatesForBrand(prisma, brandId)
  const installed = await prisma.brandTemplateConfig.count({ where: { brandId, enabled: true } })
  revalidatePath('/dashboard')
  return { installed }
}

async function getNextSystemFilename(
  brandId: string,
  type: 'VID' | 'AUD' | 'IMG',
  shortCode: string,
  ext: string,
) {
  const prefix = `${shortCode}_${type}_`
  const lastAsset = await prisma.asset.findFirst({
    where: { brandId, systemFilename: { startsWith: prefix } },
    orderBy: { systemFilename: 'desc' },
  })

  let counter = 1
  if (lastAsset) {
    const parts = lastAsset.systemFilename.split('_')
    const numPart = parts.length > 2 ? parts[2].split('.')[0] : null
    if (numPart && !isNaN(parseInt(numPart))) counter = parseInt(numPart) + 1
  }

  return `${prefix}${counter.toString().padStart(4, '0')}.${ext}`
}

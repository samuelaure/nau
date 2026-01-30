'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { ApifyService } from '@/lib/apify'
import { downloadAndUploadProfileImage } from '@/lib/profile-image-service'
import { auth } from '@/auth'
import { z } from 'zod'

const AccountSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  accessToken: z.string().min(1, 'Access Token is required'),
  platformId: z.string().min(1, 'Platform ID is required'),
})

const AccountUpdateSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  platformId: z.string().min(1, 'Platform ID is required'),
  accessToken: z.string().optional().or(z.literal('')).transform(val => val || undefined),
})

const IdSchema = z.string().min(1)

async function checkAuth() {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }
  return { user: { ...session.user, id: session.user.id } } // Ensure id is string
}

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

  // Attempt initial sync
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

  // Attempt sync on update
  await syncAccountProfile(parsedId)

  revalidatePath('/dashboard/accounts')
  revalidatePath(`/dashboard/accounts/${parsedId}`)
}

export async function syncAccountProfile(id: string) {
  await checkAuth()
  const parsedId = IdSchema.parse(id)

  const account = await prisma.socialAccount.findUnique({ where: { id: parsedId } })
  if (!account || !account.username) return

  // Remove @ if present for logic (though ApifyService also does it, good to have it there)
  const result = await ApifyService.fetchProfile(account.username)

  if (result.status === 'success') {
    let finalProfileImage = account.profileImage

    if (result.profileImage) {
      // Download from Apify (temporary link) and upload to our R2
      const r2Url = await downloadAndUploadProfileImage(result.profileImage, account.username)
      if (r2Url) {
        finalProfileImage = r2Url
      }
    }

    await prisma.socialAccount.update({
      where: { id: parsedId },
      data: {
        // Update profile image and platform ID if found
        profileImage: finalProfileImage,
        platformId: result.id || account.platformId,
      },
    })
    revalidatePath('/dashboard/accounts')
    revalidatePath(`/dashboard/accounts/${parsedId}`)
  }
}

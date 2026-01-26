'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function addAccount(formData: FormData) {
  const username = formData.get('username') as string
  const accessToken = formData.get('accessToken') as string
  const platformId = formData.get('platformId') as string

  if (!username || !accessToken || !platformId) {
    throw new Error('Missing required fields')
  }

  // Find a default user or create one for dev purposes
  let user = await prisma.user.findFirst()
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: 'Dev User',
        email: 'dev@example.com',
      },
    })
  }

  const newAccount = await prisma.socialAccount.create({
    data: {
      userId: user.id,
      platform: 'instagram',
      username,
      accessToken,
      platformId,
    },
  })

  // Attempt initial sync
  await syncAccountProfile(newAccount.id)

  revalidatePath('/dashboard/accounts')
}

export async function deleteAccount(id: string) {
  if (!id) throw new Error('Missing ID')

  await prisma.socialAccount.delete({
    where: { id },
  })

  revalidatePath('/dashboard/accounts')
}

export async function updateAccount(id: string, formData: FormData) {
  const username = formData.get('username') as string
  const platformId = formData.get('platformId') as string
  // Access token optional on update? Assuming yes, or user might re-enter it.
  const accessToken = formData.get('accessToken') as string

  if (!id || !username || !platformId) {
    throw new Error('Missing required fields')
  }

  const data: any = {
    username,
    platformId,
  }

  if (accessToken) {
    data.accessToken = accessToken
  }

  await prisma.socialAccount.update({
    where: { id },
    data,
  })

  // Attempt sync on update
  await syncAccountProfile(id)

  revalidatePath('/dashboard/accounts')
  revalidatePath(`/dashboard/accounts/${id}`)
}

import { ApifyService } from '@/lib/apify'

export async function syncAccountProfile(id: string) {
  const account = await prisma.socialAccount.findUnique({ where: { id } })
  if (!account || !account.username) return

  // Remove @ if present for logic (though ApifyService also does it, good to have it there)
  const result = await ApifyService.fetchProfile(account.username)

  if (result.status === 'success' && result.profileImage) {
    await prisma.socialAccount.update({
      where: { id },
      data: {
        // Update profile image and platform ID if found
        profileImage: result.profileImage || null,
        platformId: result.id || account.platformId,
      },
    })
    revalidatePath('/dashboard/accounts')
  }
}

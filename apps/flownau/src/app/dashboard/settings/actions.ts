'use server'

import { prisma } from '@/modules/shared/prisma'
import { revalidatePath } from 'next/cache'
import { syncR2Assets } from '@/modules/video/r2-sync-service'
import { getAuthUser } from '@/lib/auth'
import { cookies } from 'next/headers'
import { COOKIE_ACCESS_TOKEN } from '@nau/auth'
import { z } from 'zod'

const SettingSchema = z.object({
  key: z.string().min(1, 'Key is required'),
  value: z.string(), // Allowing empty string
})

async function checkAuth() {
  const user = await getAuthUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
}

import { encrypt } from '@/modules/shared/encryption'

export async function setSetting(formData: FormData) {
  await checkAuth()

  const rawData = {
    key: formData.get('key'),
    value: formData.get('value'),
  }

  const { key, value } = SettingSchema.parse(rawData)

  let finalValue = value
  if (value && (key.includes('key') || key.includes('token'))) {
    finalValue = encrypt(value)
  }

  await prisma.systemSetting.upsert({
    where: { key },
    update: { value: finalValue },
    create: { key, value: finalValue },
  })

  revalidatePath('/dashboard/settings')
}

export async function generateTelegramLinkToken(): Promise<{ deepLink?: string; error?: string }> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_ACCESS_TOKEN)?.value
  if (!token) return { error: 'Not authenticated' }

  const nauApiUrl = process.env.NAU_API_URL ?? 'http://9nau-api:3000'
  const res = await fetch(`${nauApiUrl}/auth/link-token`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) return { error: 'Failed to generate link token' }
  const { token: linkToken } = await res.json() as { token: string }

  const accountsUrl = process.env.NEXT_PUBLIC_ACCOUNTS_URL ?? 'https://accounts.9nau.com'
  return { deepLink: `${accountsUrl}/telegram/link?token=${linkToken}` }
}

export async function triggerAssetSync() {
  await checkAuth()

  try {
    const result = await syncR2Assets()
    if (result.success) {
      revalidatePath('/dashboard') // Revalidate everything just in case
      return { success: true, message: `Sync complete. ${result.logs?.length} operations logged.` }
    } else {
      return { success: false, message: result.error || 'Unknown error' }
    }
  } catch (err: unknown) {
    return { success: false, message: (err as Error).message }
  }
}

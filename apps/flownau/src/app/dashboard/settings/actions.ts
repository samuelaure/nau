'use server'

import { prisma } from '@/modules/shared/prisma'
import { revalidatePath } from 'next/cache'
import { syncR2Assets } from '@/modules/video/r2-sync-service'
import { requireAuth, getAuthUser } from '@/lib/auth'
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

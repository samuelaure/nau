'use server'

import { prisma } from '@/modules/shared/prisma'
import { revalidatePath } from 'next/cache'
import { syncR2Assets } from '@/modules/video/r2-sync-service'
import { auth } from '@/auth'
import { z } from 'zod'

const SettingSchema = z.object({
  key: z.string().min(1, 'Key is required'),
  value: z.string(), // Allowing empty string
})

async function checkAuth() {
  const session = await auth()
  if (!session?.user) {
    throw new Error('Unauthorized')
  }
}

export async function setSetting(formData: FormData) {
  await checkAuth()

  const rawData = {
    key: formData.get('key'),
    value: formData.get('value'),
  }

  const { key, value } = SettingSchema.parse(rawData)

  await prisma.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
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

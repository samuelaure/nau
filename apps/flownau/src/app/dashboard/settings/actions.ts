'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getSetting } from '@/lib/settings'
import { syncR2Assets } from '@/lib/r2-sync-service'

export { getSetting }

export async function setSetting(formData: FormData) {
  const key = formData.get('key') as string
  const value = formData.get('value') as string

  if (!key) throw new Error('Key is required')

  await prisma.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  })

  revalidatePath('/dashboard/settings')
}

export async function triggerAssetSync() {
  try {
    const result = await syncR2Assets()
    if (result.success) {
      revalidatePath('/dashboard') // Revalidate everything just in case
      return { success: true, message: `Sync complete. ${result.logs?.length} operations logged.` }
    } else {
      return { success: false, message: result.error || 'Unknown error' }
    }
  } catch (err: any) {
    return { success: false, message: err.message }
  }
}

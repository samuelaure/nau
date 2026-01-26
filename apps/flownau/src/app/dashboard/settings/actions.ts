import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getSetting } from '@/lib/settings'

export { getSetting } // Re-export for client use if needed (though getSetting is server-side)

export async function setSetting(formData: FormData) {
  'use server'
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

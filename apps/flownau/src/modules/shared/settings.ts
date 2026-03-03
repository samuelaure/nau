import { prisma } from '@/modules/shared/prisma'
import { decrypt } from '@/modules/shared/encryption'

export async function getSetting(key: string) {
  const setting = await prisma.systemSetting.findUnique({
    where: { key },
  })

  if (!setting?.value) return setting?.value

  if (key.includes('key') || key.includes('token')) {
    try {
      return decrypt(setting.value)
    } catch {
      // If decryption fails, it might be an old unencrypted token
      return setting.value
    }
  }

  return setting.value
}

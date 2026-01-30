import { prisma } from '@/modules/shared/prisma'

export async function getSetting(key: string) {
  const setting = await prisma.systemSetting.findUnique({
    where: { key },
  })
  return setting?.value
}

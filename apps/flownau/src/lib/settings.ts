import { prisma } from '@/lib/prisma'

export async function getSetting(key: string) {
  const setting = await prisma.systemSetting.findUnique({
    where: { key },
  })
  return setting?.value
}

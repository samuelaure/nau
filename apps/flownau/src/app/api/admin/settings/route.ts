import { NextResponse } from 'next/server'
import { getAuthUser, isAdminUser, adminUnauthorized } from '@/lib/auth'
import { prisma } from '@/modules/shared/prisma'
import { ADMIN_MODEL_SETTING_KEYS } from '@/modules/shared/admin-model'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getAuthUser()
  if (!user || !isAdminUser(user.id)) return adminUnauthorized()

  const keys = Object.values(ADMIN_MODEL_SETTING_KEYS)
  const rows = await prisma.systemSetting.findMany({ where: { key: { in: keys } } })
  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  return NextResponse.json({ settings })
}

export async function PATCH(req: Request) {
  const user = await getAuthUser()
  if (!user || !isAdminUser(user.id)) return adminUnauthorized()

  const body = await req.json() as Record<string, string>
  const allowedKeys = new Set(Object.values(ADMIN_MODEL_SETTING_KEYS))

  const updates = Object.entries(body).filter(([k]) => allowedKeys.has(k))
  await Promise.all(
    updates.map(([key, value]) =>
      value
        ? prisma.systemSetting.upsert({ where: { key }, update: { value }, create: { key, value } })
        : prisma.systemSetting.deleteMany({ where: { key } }),
    ),
  )

  return NextResponse.json({ ok: true })
}

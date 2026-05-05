import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/modules/shared/prisma'
import { ADMIN_MODEL_SETTING_KEYS } from '@/modules/shared/admin-model'
import AdminSettingsClient from './AdminSettingsClient'

export default async function AdminSettingsPage() {
  await requireAdmin()

  const keys = Object.values(ADMIN_MODEL_SETTING_KEYS)
  const rows = await prisma.systemSetting.findMany({ where: { key: { in: keys } } })
  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]))

  return <AdminSettingsClient initialSettings={settings} />
}

import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * WorkspaceSettingsPage
 *
 * Workspace CRUD is now owned by 9naŭ. This page becomes a thin redirect to the
 * Platform Settings page while keeping the route alive for any deep-linked bookmarks.
 * Future: re-implement as a forwarding shell that loads workspace data from 9nau-api.
 */
export default async function WorkspaceSettingsPage({
  params,
}: {
  params: { workspaceId: string }
}) {
  const { workspaceId: _workspaceId } = await params
  const user = await getAuthUser()
  if (!user?.id) redirect('/login')

  // Workspace settings are now managed exclusively via the 9naŭ Platform Settings.
  redirect(`${process.env.NEXT_PUBLIC_NAU_APP_URL ?? 'https://app.9nau.com'}/settings`)
}

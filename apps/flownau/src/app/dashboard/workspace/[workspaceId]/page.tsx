import { prisma } from '@/modules/shared/prisma'
import { Instagram, Tag, Lightbulb, CalendarDays, Send, BarChart2, AlertCircle } from 'lucide-react'
import AddAccountButton from '@/modules/accounts/components/AddAccountButton'
import { deleteAccount } from '@/modules/accounts/actions'
import ActionMenu from '@/modules/shared/components/ActionMenu'
import Link from 'next/link'
import { Card } from '@/modules/shared/components/ui/Card'
import type { AccountWithCounts } from '@/types'
import { signServiceToken } from '@nau/auth'

export const dynamic = 'force-dynamic'

type NauBrand = { id: string; name: string; logoUrl?: string | null }

const PIPELINE_STEPS = [
  { icon: Lightbulb, label: 'Ideas', description: 'Capture and organise content ideas for this brand.' },
  { icon: CalendarDays, label: 'Plans', description: 'Turn ideas into scheduled content plans.' },
  { icon: Send, label: 'Schedule', description: 'Review and approve posts before they go live.' },
  { icon: BarChart2, label: 'Analytics', description: 'Track performance once posts are published.' },
]

export default async function WorkspaceOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>
  searchParams: Promise<{ brandId?: string }>
}) {
  const { workspaceId } = await params
  const { brandId } = await searchParams
  const nauApiUrl = process.env.NAU_API_URL || 'http://9nau-api:3000'

  const serviceToken = await signServiceToken({
    iss: 'flownau',
    aud: '9nau-api',
    secret: process.env.AUTH_SECRET ?? '',
  })
  const workspaceResp = await fetch(`${nauApiUrl}/_service/workspaces/${workspaceId}`, {
    headers: { Authorization: `Bearer ${serviceToken}` },
    cache: 'no-store',
  })

  if (!workspaceResp.ok) {
    console.error(`[WORKSPACES] Failed to fetch workspace ${workspaceId}: ${workspaceResp.status}`)
    return (
      <div className="flex flex-col items-center justify-center pt-20 animate-fade-in">
        <h2 className="text-2xl font-bold mb-4">Workspace Unavailable</h2>
        <p className="text-text-secondary mb-8">Could not load this workspace. Please try again.</p>
        <a href="/dashboard" className="btn-primary px-6 py-2">Back to Dashboard</a>
      </div>
    )
  }

  const workspace = (await workspaceResp.json()) as { name: string; brands: NauBrand[] }
  const brands: NauBrand[] = workspace.brands ?? []

  // ── Brand dashboard ────────────────────────────────────────────────────────
  if (brandId) {
    const activeBrand = brands.find((b) => b.id === brandId)

    const socialProfiles = await prisma.socialAccount.findMany({
      where: { workspaceId, brandId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { templates: true, assets: true } } },
    })

    const hasNoSocialProfile = socialProfiles.length === 0

    return (
      <div className="animate-fade-in">
        {/* Breadcrumb + header */}
        <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <p className="text-text-secondary text-sm mb-1">
              <Link href={`/dashboard/workspace/${workspaceId}`} className="hover:text-white transition-colors">
                {workspace.name}
              </Link>
              {' / '}
              <span className="text-white">{activeBrand?.name ?? 'Brand'}</span>
            </p>
            <h1 className="text-3xl font-heading font-semibold">{activeBrand?.name ?? 'Brand'}</h1>
          </div>
          <AddAccountButton
            existingAccounts={socialProfiles.map((a) => ({ id: a.id, username: a.username, accessToken: a.accessToken }))}
            workspaceId={workspaceId}
            mode="social-profile"
          />
        </header>

        {/* Non-blocking social profile notice */}
        {hasNoSocialProfile && (
          <div className="flex items-start gap-3 px-4 py-3 mb-8 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-400">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <p className="text-sm">
              No social profile linked yet. You can configure the full pipeline now —{' '}
              <span className="font-medium">publishing will be unlocked once you add a Social Profile.</span>
            </p>
          </div>
        )}

        {/* Pipeline steps */}
        <section className="mb-10">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">Content Pipeline</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
            {PIPELINE_STEPS.map(({ icon: Icon, label, description }) => (
              <Card key={label} className="p-5 flex flex-col gap-3 opacity-80 hover:opacity-100 transition-opacity">
                <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Icon size={18} className="text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-1">{label}</h3>
                  <p className="text-xs text-text-secondary leading-relaxed">{description}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Social profiles section */}
        <section>
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">Social Profiles</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-6">
            {socialProfiles.map((account: AccountWithCounts) => (
              <Card key={account.id} className="relative group hover:border-accent/40 transition-colors">
                <Link href={`/dashboard/workspace/${workspaceId}/account/${account.id}`} className="absolute inset-0 z-[1]" />
                <ActionMenu onDelete={deleteAccount.bind(null, account.id)} />
                <div className="relative z-[2] pointer-events-none">
                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-[60px] h-[60px] rounded-full p-[2px] bg-[linear-gradient(45deg,#f09433_0%,#e6683c_25%,#dc2743_50%,#cc2366_75%,#bc1888_100%)] overflow-hidden shrink-0">
                      <div className="w-full h-full rounded-full bg-panel flex items-center justify-center overflow-hidden">
                        {account.profileImage ? (
                          <img src={account.profileImage} alt={account.username || 'Profile'} className="w-full h-full object-cover" />
                        ) : (
                          <Instagram size={28} />
                        )}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">{account.username || 'Syncing...'}</h3>
                      <p className="text-xs text-text-secondary">Added on {new Date(account.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1 p-3 bg-white/5 rounded-lg text-center">
                      <p className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">Status</p>
                      <p className="text-sm font-semibold text-success">Connected</p>
                    </div>
                    <div className="flex-1 p-3 bg-white/5 rounded-lg text-center">
                      <p className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">Templates</p>
                      <p className="text-sm font-semibold">{account._count?.templates || 0}</p>
                    </div>
                  </div>
                </div>
              </Card>
            ))}

            {hasNoSocialProfile && (
              <Card className="col-span-full py-10 px-10 text-center border-dashed bg-transparent flex flex-col items-center">
                <Instagram size={36} className="text-text-secondary mb-3 opacity-40" />
                <h3 className="text-base font-semibold mb-1">No social profiles yet</h3>
                <p className="text-text-secondary text-sm mb-5">Connect an Instagram Business account to enable publishing.</p>
                <AddAccountButton workspaceId={workspaceId} mode="social-profile" />
              </Card>
            )}
          </div>
        </section>
      </div>
    )
  }

  // ── Workspace overview — brand list ────────────────────────────────────────
  return (
    <div className="animate-fade-in">
      <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-heading font-semibold mb-2">{workspace.name}</h1>
          <p className="text-text-secondary">Select a brand to manage its content pipeline.</p>
        </div>
        <AddAccountButton workspaceId={workspaceId} mode="brand" />
      </header>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-6">
        {brands.map((brand) => (
          <Link key={brand.id} href={`/dashboard/workspace/${workspaceId}?brandId=${brand.id}`}>
            <Card className="relative group hover:border-accent/40 transition-colors cursor-pointer p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                <Tag size={22} className="text-accent" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-semibold truncate group-hover:text-accent transition-colors">{brand.name}</h3>
                <p className="text-xs text-text-secondary mt-0.5">View brand</p>
              </div>
            </Card>
          </Link>
        ))}

        {brands.length === 0 && (
          <Card className="col-span-full py-20 px-10 text-center border-dashed bg-transparent flex flex-col items-center">
            <Tag size={48} className="text-text-secondary mb-4 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">No brands yet</h3>
            <p className="text-text-secondary mb-6">Create your first brand to get started.</p>
            <AddAccountButton workspaceId={workspaceId} mode="brand" />
          </Card>
        )}
      </div>
    </div>
  )
}

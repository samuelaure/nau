import { prisma } from '@/modules/shared/prisma'
import { Tag, Settings } from 'lucide-react'
import { addBrand } from '@/modules/accounts/actions'
import Link from 'next/link'
import { Card } from '@/modules/shared/components/ui/Card'
import { signServiceToken } from '@nau/auth'
import { notFound } from 'next/navigation'
import { cn } from '@/modules/shared/utils'
import AccountCalendar from '@/modules/accounts/components/AccountCalendar'
import BrandPosts from '@/modules/accounts/components/BrandPosts'
import AccountPool from '@/modules/accounts/components/AccountPool'
import AccountCompositions from '@/modules/accounts/components/AccountCompositions'
import AccountTemplates from '@/modules/accounts/components/AccountTemplates'
import BrandProfiles from '@/modules/accounts/components/BrandProfiles'
import BrandSettings from '@/modules/accounts/components/BrandSettings'
import AddBrandButton from '@/modules/accounts/components/AddBrandButton'
import AssetsManager from '@/modules/shared/components/AssetsManager'

export const dynamic = 'force-dynamic'

type NauBrand = { id: string; name: string; logoUrl?: string | null }

const TABS = [
  { id: 'calendar', label: 'Calendar' },
  { id: 'ideas', label: 'Ideas' },
  { id: 'templates', label: 'Templates' },
  { id: 'pool', label: 'Pool' },
  { id: 'compositions', label: 'Compositions' },
  { id: 'profiles', label: 'Profiles' },
  { id: 'assets', label: 'Assets' },
  { id: 'settings', label: 'Settings' },
] as const

type Tab = (typeof TABS)[number]['id']


export default async function WorkspaceOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>
  searchParams: Promise<{ brandId?: string; tab?: string; returnTab?: string }>
}) {
  const { workspaceId } = await params
  const { brandId, tab: tabParam, returnTab } = await searchParams
  const activeTab: Tab = (TABS.find((t) => t.id === tabParam)?.id ?? 'calendar') as Tab
  const safeReturnTab = (TABS.find((t) => t.id === returnTab && t.id !== 'settings')?.id ?? 'calendar') as Tab

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
    const nauBrand = brands.find((b) => b.id === brandId)
    if (!nauBrand) notFound()

    // Upsert local Brand record so it always exists before rendering
    const localBrand = await prisma.brand.upsert({
      where: { id: brandId },
      create: { id: brandId, workspaceId, name: nauBrand.name },
      update: { name: nauBrand.name },
    })

    const socialProfiles = await prisma.socialProfile.findMany({
      where: { brandId },
      orderBy: { createdAt: 'desc' },
    })

    const postSchedule = activeTab === 'settings'
      ? await prisma.postSchedule.findUnique({ where: { brandId } })
      : null

    const assets = activeTab === 'assets'
      ? await prisma.asset.findMany({
          where: { brandId },
          orderBy: { createdAt: 'desc' },
          take: 48,
        })
      : []

    const basePath = localBrand.assetsRoot || localBrand.shortCode || brandId

    return (
      <div className="animate-fade-in">
        {/* Breadcrumb + Brand Settings button */}
        <header className="mb-8 flex items-center justify-between gap-4">
          <p className="text-text-secondary text-sm">
            <Link href={`/dashboard/workspace/${workspaceId}`} className="hover:text-white transition-colors">
              {workspace.name}
            </Link>
            {' / '}
            <span className="text-white">{nauBrand.name}</span>
          </p>
          <Link
            href={
              activeTab === 'settings'
                ? `/dashboard/workspace/${workspaceId}?brandId=${brandId}&tab=${safeReturnTab}`
                : `/dashboard/workspace/${workspaceId}?brandId=${brandId}&tab=settings&returnTab=${activeTab}`
            }
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors whitespace-nowrap',
              activeTab === 'settings'
                ? 'bg-accent/10 text-accent font-semibold'
                : 'text-text-secondary hover:text-white hover:bg-white/5',
            )}
          >
            <Settings size={14} />
            Brand Settings
          </Link>
        </header>

        {/* Tab content */}
        <div className="min-h-[400px]">
          {activeTab === 'calendar' && <AccountCalendar brandId={brandId} />}
          {activeTab === 'ideas' && <BrandPosts brandId={brandId} />}
          {activeTab === 'pool' && <AccountPool brandId={brandId} workspaceId={workspaceId} />}
          {activeTab === 'compositions' && <AccountCompositions brandId={brandId} />}
          {activeTab === 'templates' && <AccountTemplates brandId={brandId} workspaceId={workspaceId} />}
          {activeTab === 'profiles' && (
            <BrandProfiles
              brandId={brandId}
              workspaceId={workspaceId}
              initialProfiles={socialProfiles.map((p) => ({
                id: p.id,
                platform: p.platform,
                username: p.username,
                profileImage: p.profileImage,
                platformId: p.platformId,
                tokenExpiresAt: p.tokenExpiresAt?.toISOString() ?? null,
                createdAt: p.createdAt.toISOString(),
              }))}
            />
          )}
          {activeTab === 'assets' && (
            <AssetsManager ownerId={brandId} ownerType="brand" assets={assets} basePath={basePath} />
          )}
          {activeTab === 'settings' && (
            <BrandSettings
              brand={{
                id: localBrand.id,
                language: localBrand.language,
                ideationCount: localBrand.ideationCount,
                autoApproveIdeas: localBrand.autoApproveIdeas,
                directorPrompt: localBrand.directorPrompt,
                creationPrompt: localBrand.creationPrompt,
                shortCode: localBrand.shortCode,
              }}
              initialSchedule={postSchedule ? {
                formatChain: postSchedule.formatChain,
                dailyFrequency: postSchedule.dailyFrequency,
                windowStart: postSchedule.windowStart,
                windowEnd: postSchedule.windowEnd,
                timezone: postSchedule.timezone,
                isActive: postSchedule.isActive,
              } : null}
            />
          )}
        </div>
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
        <AddBrandButton workspaceId={workspaceId} />
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
            <AddBrandButton workspaceId={workspaceId} />
          </Card>
        )}
      </div>
    </div>
  )
}

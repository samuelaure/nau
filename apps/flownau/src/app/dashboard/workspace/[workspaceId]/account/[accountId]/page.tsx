export const dynamic = 'force-dynamic'

import { prisma } from '@/modules/shared/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Instagram } from 'lucide-react'
import AssetsManager from '@/modules/shared/components/AssetsManager'
import AccountSettings from '@/modules/accounts/components/AccountSettings'
import AccountSettingsTabs from '@/modules/accounts/components/AccountSettingsTabs'
import AccountIdeas from '@/modules/accounts/components/AccountIdeas'
import AccountPool from '@/modules/accounts/components/AccountPool'
import AccountCalendar from '@/modules/accounts/components/AccountCalendar'
import AccountTemplates from '@/modules/accounts/components/AccountTemplates'
import ExternalAccountLink from '@/modules/accounts/components/ExternalAccountLink'
import BrandBreadcrumb from '@/modules/accounts/components/BrandBreadcrumb'
import { cn } from '@/modules/shared/utils'

export default async function WorkspaceAccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string; accountId: string }>
  searchParams: Promise<{ tab?: string; date?: string }>
}) {
  const { workspaceId, accountId } = await params
  const { tab } = await searchParams
  const activeTab = tab || 'calendar'

  const [account, defaultPlanner] = await Promise.all([
    prisma.socialAccount.findUnique({
      where: { id: accountId },
      include: {
        _count: { select: { templates: true, assets: true } },
      },
    }),
    prisma.contentPlanner.findFirst({
      where: { accountId, isDefault: true },
    }),
  ])

  if (!account || account.workspaceId !== workspaceId) {
    notFound()
  }

  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()
  const tokenDaysLeft = account.tokenExpiresAt
    ? Math.ceil((new Date(account.tokenExpiresAt).getTime() - now) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div className="animate-fade-in">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-text-secondary mb-6 text-sm">
        <Link
          href={`/dashboard/workspace/${workspaceId}`}
          className="hover:text-white transition-colors"
        >
          Overview
        </Link>
        <ChevronRight size={16} />
        <BrandBreadcrumb
          workspaceId={workspaceId}
          activeAccountId={accountId}
          activeUsername={account.username ?? accountId}
        />
      </div>

      {/* Header */}
      <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="flex gap-6 items-center">
          <div className="w-16 h-16 rounded-full p-[2px] bg-[linear-gradient(45deg,#f09433_0%,#e6683c_25%,#dc2743_50%,#cc2366_75%,#bc1888_100%)] overflow-hidden shrink-0">
            <div className="w-full h-full rounded-full bg-panel flex items-center justify-center">
              {account.profileImage ? (
                <img
                  src={account.profileImage}
                  alt={account.username || ''}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Instagram size={32} />
              )}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-heading font-semibold">@{account.username}</h1>
              <ExternalAccountLink username={account.username} />
              {tokenDaysLeft !== null && (
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider',
                    tokenDaysLeft <= 7
                      ? 'bg-red-500/10 text-red-400'
                      : 'bg-emerald-500/10 text-emerald-400',
                  )}
                >
                  Token: {tokenDaysLeft}d
                </span>
              )}
            </div>
            <p className="text-text-secondary text-sm">
              Targeting {defaultPlanner?.reelsPerDay || 0} reels / day
            </p>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-white/5 mb-8 overflow-x-auto no-scrollbar">
        <TabLink href={`?tab=calendar`} active={activeTab === 'calendar'} label="Calendar" />
        <TabLink href={`?tab=ideas`} active={activeTab === 'ideas'} label="Ideas" />
        <TabLink href={`?tab=pool`} active={activeTab === 'pool'} label="Content Pool" />
        <TabLink href={`?tab=templates`} active={activeTab === 'templates'} label="Templates" />
        <TabLink
          href={`?tab=assets`}
          active={activeTab === 'assets'}
          label="Assets"
          count={account._count.assets}
        />
        <TabLink href={`?tab=settings`} active={activeTab === 'settings'} label="Settings" />
      </div>

      {/* Content Sections */}
      <div className="min-h-[400px]">
        {activeTab === 'calendar' && <AccountCalendar accountId={accountId} />}
        {activeTab === 'ideas' && <AccountIdeas accountId={accountId} />}
        {activeTab === 'pool' && <AccountPool accountId={accountId} />}
        {activeTab === 'assets' && <AccountAssets accountId={accountId} />}
        {activeTab === 'templates' && <AccountTemplates accountId={accountId} />}
        {activeTab === 'settings' && (
          <AccountSettingsTabs
            accountId={accountId}
            accountForm={<AccountSettings account={account} />}
          />
        )}
      </div>
    </div>
  )
}

function TabLink({
  href,
  active,
  label,
  count,
}: {
  href: string
  active: boolean
  label: string
  count?: number
}) {
  return (
    <Link
      href={href}
      className={cn(
        'px-5 py-3 -mb-px flex items-center gap-2 border-b-2 text-sm transition-all whitespace-nowrap',
        active
          ? 'text-accent border-accent font-semibold'
          : 'text-text-secondary border-transparent hover:text-white',
      )}
    >
      {label}
      {count !== undefined && <span className="opacity-50 text-xs">({count})</span>}
    </Link>
  )
}

async function AccountAssets({ accountId }: { accountId: string }) {
  const assets = await prisma.asset.findMany({
    where: { accountId },
    orderBy: { createdAt: 'desc' },
    take: 24,
  })
  const account = await prisma.socialAccount.findUnique({ where: { id: accountId } })
  const basePath = account?.assetsRoot || account?.username || accountId
  return (
    <AssetsManager ownerId={accountId} ownerType="account" assets={assets} basePath={basePath} />
  )
}

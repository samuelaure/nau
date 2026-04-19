export const dynamic = 'force-dynamic'

import { prisma } from '@/modules/shared/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Instagram, Calendar } from 'lucide-react'
import AssetsManager from '@/modules/shared/components/AssetsManager'
import AccountSettings from '@/modules/accounts/components/AccountSettings'
import AccountPersonas from '@/modules/accounts/components/AccountPersonas'
import AccountIdeas from '@/modules/accounts/components/AccountIdeas'
import AccountPool from '@/modules/accounts/components/AccountPool'
import AccountCalendar from '@/modules/accounts/components/AccountCalendar'
import AccountFinalReview from '@/modules/accounts/components/AccountFinalReview'
import AccountPlanners from '@/modules/accounts/components/AccountPlanners'
import AccountContentPrinciples from '@/modules/accounts/components/AccountContentPrinciples'
import AccountTemplates from '@/modules/accounts/components/AccountTemplates'
import ExternalAccountLink from '@/modules/accounts/components/ExternalAccountLink'
import { cn } from '@/modules/shared/utils'
import { Button } from '@/modules/shared/components/ui/Button'
import DailyScheduleView from '@/modules/plans/components/DailyScheduleView'

export default async function WorkspaceAccountPage({
  params,
  searchParams,
}: {
  params: { workspaceId: string; accountId: string }
  searchParams: { tab?: string; date?: string }
}) {
  const { workspaceId, accountId } = await params
  const { tab, date } = await searchParams
  const activeTab = tab || 'calendar'

  const account = await prisma.socialAccount.findUnique({
    where: { id: accountId },
    include: {
      _count: {
        select: { templates: true, assets: true },
      },
      contentPlanners: { where: { isDefault: true }, take: 1 },
    },
  })

  const defaultPlanner = account?.contentPlanners?.[0] ?? null

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
          Workspace Overview
        </Link>
        <ChevronRight size={16} />
        <span className="text-white">@{account.username}</span>
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

        <div className="flex gap-3">
          <Button variant="outline" size="sm" className="gap-2">
            <Calendar size={16} /> Monthly View
          </Button>
        </div>
      </header>

      {/* Modern Tabs */}
      <div className="flex border-b border-white/5 mb-8 overflow-x-auto no-scrollbar">
        <TabLink href={`?tab=calendar`} active={activeTab === 'calendar'} label="Calendar" />
        <TabLink href={`?tab=schedule`} active={activeTab === 'schedule'} label="Daily Schedule" />
        <TabLink
          href={`?tab=compositions`}
          active={activeTab === 'compositions'}
          label="Compositions"
        />
        <TabLink href={`?tab=ideas`} active={activeTab === 'ideas'} label="Ideas" />
        <TabLink
          href={`?tab=assets`}
          active={activeTab === 'assets'}
          label="Assets"
          count={account._count.assets}
        />
        <TabLink
          href={`?tab=final-review`}
          active={activeTab === 'final-review'}
          label="Final Review"
        />
        <TabLink href={`?tab=personas`} active={activeTab === 'personas'} label="Personas" />
        <TabLink href={`?tab=principles`} active={activeTab === 'principles'} label="Principles" />
        <TabLink href={`?tab=planner`} active={activeTab === 'planner'} label="Planner" />
        <TabLink href={`?tab=templates`} active={activeTab === 'templates'} label="Templates" />
        <TabLink href={`?tab=settings`} active={activeTab === 'settings'} label="Settings" />
      </div>

      {/* Content Sections */}
      <div className="min-h-[400px]">
        {activeTab === 'calendar' && <AccountCalendar accountId={accountId} />}
        {activeTab === 'schedule' && (
          <AccountSchedule accountId={accountId} workspaceId={workspaceId} dateStr={date} />
        )}
        {activeTab === 'compositions' && <AccountPool accountId={accountId} />}
        {activeTab === 'ideas' && <AccountIdeas accountId={accountId} />}
        {activeTab === 'assets' && <AccountAssets accountId={accountId} />}
        {activeTab === 'final-review' && <AccountFinalReview accountId={accountId} />}
        {activeTab === 'personas' && <AccountPersonas accountId={accountId} />}
        {activeTab === 'principles' && <AccountContentPrinciples accountId={accountId} />}
        {activeTab === 'planner' && <AccountPlanners accountId={accountId} />}
        {activeTab === 'templates' && <AccountTemplates accountId={accountId} />}
        {activeTab === 'settings' && <AccountSettings account={account} />}
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

async function AccountSchedule({
  accountId,
  workspaceId,
  dateStr,
}: {
  accountId: string
  workspaceId: string
  dateStr?: string
}) {
  const targetDate = dateStr ? new Date(dateStr) : new Date()
  targetDate.setHours(0, 0, 0, 0)

  const prevDate = new Date(targetDate)
  prevDate.setDate(prevDate.getDate() - 1)

  const nextDate = new Date(targetDate)
  nextDate.setDate(nextDate.getDate() + 1)

  const toDateParam = (d: Date) => d.toISOString().split('T')[0]

  const plan = await prisma.contentPlan.findFirst({
    where: {
      accountId,
      date: {
        gte: targetDate,
        lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000),
      },
    },
    include: { account: true },
  })

  const account = await prisma.socialAccount.findUnique({ where: { id: accountId } })

  let mappedPlan = null
  if (plan && account) {
    const pieces = (plan.pieces as any[]) ?? []
    const planAlerts = (plan.pieces as any)?.alerts ?? []

    const FORMAT_LABELS: Record<string, string> = {
      reel: 'Reel',
      trial_reel: 'Trial Reel',
      carousel: 'Carousel',
      single_image: 'Image',
    }

    const slots = pieces.map((p) => ({
      time: p.scheduledAt
        ? new Date(p.scheduledAt).toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
          })
        : 'Unassigned',
      type: FORMAT_LABELS[p.format] || p.format,
      status: p.status,
      compositionId: p.id,
    }))

    mappedPlan = {
      accountId: plan.accountId,
      username: account.username || 'Unknown',
      profileImage: account.profileImage || null,
      alerts: planAlerts,
      slots,
      pieces,
    }
  }

  const basePath = `/dashboard/workspace/${workspaceId}/account/${accountId}`
  const isToday = toDateParam(targetDate) === toDateParam(new Date())

  return (
    <DailyScheduleView
      dateParam={toDateParam(targetDate)}
      prevDateParam={toDateParam(prevDate)}
      nextDateParam={toDateParam(nextDate)}
      formattedDate={targetDate.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })}
      isToday={isToday}
      plans={mappedPlan ? [mappedPlan] : []}
      context="brand"
      basePath={basePath}
    />
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

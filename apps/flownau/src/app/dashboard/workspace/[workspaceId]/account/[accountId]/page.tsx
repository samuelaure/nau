export const dynamic = 'force-dynamic'

import { prisma } from '@/modules/shared/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Instagram, AlertTriangle, CheckCircle2, Calendar, Clock } from 'lucide-react'
import AssetsManager from '@/modules/shared/components/AssetsManager'
import AccountSettings from '@/modules/accounts/components/AccountSettings'
import AccountPersonas from '@/modules/accounts/components/AccountPersonas'
import AccountIdeas from '@/modules/accounts/components/AccountIdeas'
import ExternalAccountLink from '@/modules/accounts/components/ExternalAccountLink'
import { cn } from '@/modules/shared/utils'
import { approveComposition } from '@/modules/compositions/actions'
import { Button } from '@/modules/shared/components/ui/Button'
import { Card } from '@/modules/shared/components/ui/Card'

export default async function WorkspaceAccountPage({
  params,
  searchParams,
}: {
  params: { workspaceId: string; accountId: string }
  searchParams: { tab?: string }
}) {
  const { workspaceId, accountId } = await params
  const { tab } = await searchParams
  const activeTab = tab || 'schedule'

  const account = await prisma.socialAccount.findUnique({
    where: { id: accountId },
    include: {
      _count: {
        select: { templates: true, assets: true },
      },
      postingSchedule: true,
    },
  })

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
              Targeting {account.postingSchedule?.reelsPerDay || 0} reels / day
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
        <TabLink href={`?tab=personas`} active={activeTab === 'personas'} label="Personas" />
        <TabLink href={`?tab=settings`} active={activeTab === 'settings'} label="Settings" />
      </div>

      {/* Content Sections */}
      <div className="min-h-[400px]">
        {activeTab === 'schedule' && <AccountSchedule accountId={accountId} />}
        {activeTab === 'compositions' && <AccountCompositions accountId={accountId} />}
        {activeTab === 'ideas' && <AccountIdeas accountId={accountId} />}
        {activeTab === 'assets' && <AccountAssets accountId={accountId} />}
        {activeTab === 'personas' && <AccountPersonas accountId={accountId} />}
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

async function AccountSchedule({ accountId }: { accountId: string }) {
  // Fetch planned content for today
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const plan = await prisma.contentPlan.findUnique({
    where: { accountId_date: { accountId, date: today } },
  })

  // Simulated hour-based slots (In a real scenario, we'd map the plan pieces to HH:mm slots)
  const slots = [
    { time: '09:00', type: 'Reel', status: 'Scheduled', compositionId: '1' },
    { time: '12:00', type: 'Trial Reel', status: 'Pending', compositionId: null },
    { time: '18:00', type: 'Reel', status: 'Ready', compositionId: '2' },
    { time: '21:00', type: 'Carousel', status: 'Published', compositionId: '3' },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-heading font-semibold">Today's Posting Pipeline</h3>
        <p className="text-sm text-text-secondary">
          {new Date().toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      <div className="grid gap-4">
        {slots.map((slot, i) => (
          <Card
            key={i}
            className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors border-white/5"
          >
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-accent bg-accent/10 px-3 py-1.5 rounded-lg">
                <Clock size={16} />
                <span className="font-bold font-mono">{slot.time}</span>
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-text-secondary block mb-1">
                  {slot.type}
                </span>
                <p className="font-semibold">
                  {slot.compositionId ? `Composition #${slot.compositionId}` : 'Unassigned Slot'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span
                className={cn(
                  'px-2 py-1 rounded text-[10px] font-bold uppercase',
                  slot.status === 'Published'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : slot.status === 'Scheduled'
                      ? 'bg-blue-500/10 text-blue-400'
                      : 'bg-white/5 text-text-secondary',
                )}
              >
                {slot.status}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="text-accent underline hover:bg-transparent px-0"
              >
                Edit Slot
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

// Re-using existing components logic but styled for the new layout
async function AccountCompositions({ accountId }: { accountId: string }) {
  const compositions = await prisma.composition.findMany({
    where: { accountId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { renderJob: true },
  })

  return (
    <Card className="p-0 overflow-hidden border-white/5">
      <table className="w-full text-left text-sm">
        <thead className="bg-white/5 text-text-secondary">
          <tr>
            <th className="p-4 font-heading">Format</th>
            <th className="p-4 font-heading">Status</th>
            <th className="p-4 font-heading">Created</th>
            <th className="p-4 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {compositions.map((c) => (
            <tr key={c.id} className="border-t border-white/5">
              <td className="p-4 capitalize">{c.format.replace('_', ' ')}</td>
              <td className="p-4">
                <span className="px-2 py-0.5 rounded bg-white/5 text-[10px] font-bold uppercase">
                  {c.status}
                </span>
              </td>
              <td className="p-4 text-text-secondary">
                {new Date(c.createdAt).toLocaleDateString()}
              </td>
              <td className="p-4 text-right">
                <Link
                  href={`/dashboard/compositions/${c.id}`}
                  className="text-accent hover:underline"
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
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

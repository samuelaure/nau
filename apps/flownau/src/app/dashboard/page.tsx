import { prisma } from '@/modules/shared/prisma'
import { Instagram, Clapperboard, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Card } from '@/modules/shared/components/ui/Card'
import { Button } from '@/modules/shared/components/ui/Button'
import Link from 'next/link'
import type { CompositionWithRelations } from '@/types'

export const dynamic = 'force-dynamic'

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-amber-500/10 text-amber-400',
  approved: 'bg-blue-500/10 text-blue-400',
  rendering: 'bg-purple-500/10 text-purple-400',
  rendered: 'bg-cyan-500/10 text-cyan-400',
  scheduled: 'bg-indigo-500/10 text-indigo-400',
  publishing: 'bg-orange-500/10 text-orange-400',
  published: 'bg-emerald-500/10 text-emerald-400',
  failed: 'bg-red-500/10 text-red-400',
}

const FORMAT_LABELS: Record<string, string> = {
  reel: 'Reel',
  trial_reel: 'Trial Reel',
  carousel: 'Carousel',
  single_image: 'Image',
}

export default async function DashboardPage() {
  const now = new Date()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const fourteenDaysFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

  const [
    accountsCount,
    compositionsCount,
    publishedToday,
    recentCompositions,
    expiringAccounts,
    pendingIdeasCount,
  ] = await Promise.all([
    prisma.socialAccount.count(),
    prisma.composition.count(),
    prisma.composition.count({
      where: { status: 'published', updatedAt: { gte: today } },
    }),
    prisma.composition.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: {
        account: { select: { id: true, username: true } },
        renderJob: true,
        idea: { select: { id: true, ideaText: true, source: true, sourceRef: true } },
      },
    }),
    prisma.socialAccount.findMany({
      where: {
        tokenExpiresAt: {
          lte: fourteenDaysFromNow,
          gt: now,
        },
      },
      select: { id: true, username: true, tokenExpiresAt: true },
    }),
    prisma.contentIdea.count({ where: { status: 'PENDING' } }),
  ])

  const stats = [
    {
      name: 'Active Accounts',
      value: accountsCount,
      icon: Instagram,
      iconClass: 'text-[#E1306C]',
      bgClass: 'bg-[#E1306C]/15',
    },
    {
      name: 'Total Compositions',
      value: compositionsCount,
      icon: Clapperboard,
      iconClass: 'text-[var(--accent-color)]',
      bgClass: 'bg-[var(--accent-color)]/15',
    },
    {
      name: 'Published Today',
      value: publishedToday,
      icon: CheckCircle2,
      iconClass: 'text-emerald-400',
      bgClass: 'bg-emerald-500/15',
    },
  ]

  const hasAlerts = expiringAccounts.length > 0 || pendingIdeasCount > 0

  return (
    <div className="animate-fade-in">
      <header className="mb-10">
        <h1 className="text-3xl font-heading font-semibold mb-2">Dashboard Overview</h1>
        <p className="text-text-secondary">Monitor your automated content pipeline.</p>
      </header>

      {/* Alerts Block */}
      {hasAlerts && (
        <div className="mb-8 flex flex-col gap-3">
          {expiringAccounts.map((acc) => (
            <div
              key={acc.id}
              className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm"
            >
              <AlertTriangle size={16} className="shrink-0" />
              <span>
                <strong>@{acc.username}</strong> — Instagram token expiring on{' '}
                {acc.tokenExpiresAt ? new Date(acc.tokenExpiresAt).toLocaleDateString() : 'unknown'}
                .{' '}
                <Link href={`/dashboard/accounts/${acc.id}?tab=settings`} className="underline">
                  Review settings
                </Link>
              </span>
            </div>
          ))}
          {pendingIdeasCount > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm">
              <AlertTriangle size={16} className="shrink-0" />
              <span>
                <strong>{pendingIdeasCount} pending ideas</strong> awaiting review.{' '}
                <Link href="/dashboard/ideas" className="underline">
                  Review Ideas Bank
                </Link>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-6 mb-12">
        {stats.map((stat) => (
          <Card key={stat.name} className="flex items-center gap-5">
            <div className={`p-3 rounded-xl ${stat.bgClass} ${stat.iconClass}`}>
              <stat.icon size={28} />
            </div>
            <div>
              <p className="text-sm text-text-secondary font-medium">{stat.name}</p>
              <h3 className="text-2xl font-heading font-bold">{stat.value}</h3>
            </div>
          </Card>
        ))}
      </div>

      {/* Recent Compositions */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-heading font-semibold">Recent Compositions</h2>
          <Link href="/dashboard/compositions">
            <Button variant="ghost" size="sm" className="text-accent text-sm font-semibold">
              View All →
            </Button>
          </Link>
        </div>
        <div className="glass overflow-hidden">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-white/5 text-text-secondary text-sm font-medium">
                <th className="p-4 pl-6 font-heading">Account</th>
                <th className="p-4 font-heading">Format</th>
                <th className="p-4 font-heading">Status</th>
                <th className="p-4 font-heading">Scheduled</th>
                <th className="p-4 pr-6 font-heading">Action</th>
              </tr>
            </thead>
            <tbody>
              {(recentCompositions as CompositionWithRelations[]).map((comp) => (
                <tr
                  key={comp.id}
                  className="border-b border-white/5 text-sm hover:bg-white/5 transition-colors duration-200"
                >
                  <td className="p-4 pl-6 font-medium text-white">
                    @{comp.account?.username ?? '—'}
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 rounded text-xs bg-white/5 text-text-secondary font-medium">
                      {FORMAT_LABELS[comp.format] ?? comp.format}
                    </span>
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-2.5 py-1 rounded-md text-xs font-bold tracking-wide ${
                        STATUS_STYLES[comp.status] ?? 'bg-white/5 text-text-secondary'
                      }`}
                    >
                      {comp.status}
                    </span>
                  </td>
                  <td className="p-4 text-text-secondary">
                    {comp.scheduledAt
                      ? new Date(comp.scheduledAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                  </td>
                  <td className="p-4 pr-6">
                    <Link href={`/dashboard/compositions/${comp.id}`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-accent hover:text-accent-hover font-semibold text-sm transition-colors"
                      >
                        View
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
              {recentCompositions.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-text-secondary italic">
                    No compositions yet. Approve ideas from the Ideas Bank to generate them.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

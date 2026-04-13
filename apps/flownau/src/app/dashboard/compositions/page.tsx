import { prisma } from '@/modules/shared/prisma'
import { Card } from '@/modules/shared/components/ui/Card'
import { Button } from '@/modules/shared/components/ui/Button'
import Link from 'next/link'
import { Clapperboard } from 'lucide-react'
import { approveComposition, deleteComposition } from '@/modules/compositions/actions'
import type { CompositionWithRelations } from '@/types'

export const dynamic = 'force-dynamic'

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  approved: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  rendering: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  rendered: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  scheduled: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  publishing: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  published: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  failed: 'bg-red-500/10 text-red-400 border-red-500/20',
}

const FORMAT_LABELS: Record<string, string> = {
  reel: 'Reel',
  trial_reel: 'Trial Reel',
  carousel: 'Carousel',
  single_image: 'Image',
}

export default async function CompositionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; format?: string; accountId?: string }>
}) {
  const { status, format, accountId } = await searchParams

  const compositions = await prisma.composition.findMany({
    where: {
      ...(accountId ? { accountId } : {}),
      ...(status ? { status } : {}),
      ...(format ? { format } : {}),
    },
    take: 50,
    orderBy: { createdAt: 'desc' },
    include: {
      account: { select: { id: true, username: true } },
      renderJob: true,
      idea: { select: { id: true, ideaText: true, source: true, sourceRef: true } },
    },
  })

  const accounts = await prisma.socialAccount.findMany({
    select: { id: true, username: true },
    orderBy: { username: 'asc' },
  })

  const statuses = [
    'draft',
    'approved',
    'rendering',
    'rendered',
    'scheduled',
    'publishing',
    'published',
    'failed',
  ]
  const formats = ['reel', 'trial_reel', 'carousel', 'single_image']

  function buildFilterUrl(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams()
    const merged = { status, format, accountId, ...overrides }
    Object.entries(merged).forEach(([k, v]) => {
      if (v) params.set(k, v)
    })
    const qs = params.toString()
    return `/dashboard/compositions${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="animate-fade-in">
      <header className="mb-8">
        <h1 className="text-3xl font-heading font-semibold mb-2">Compositions</h1>
        <p className="text-text-secondary">All content pieces across the pipeline.</p>
      </header>

      {/* Filter Bar */}
      <Card className="mb-8 p-4 flex flex-wrap gap-3 items-center">
        {/* Account filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary font-medium uppercase tracking-wide">
            Account
          </span>
          <div className="flex gap-1 flex-wrap">
            <Link href={buildFilterUrl({ accountId: undefined })}>
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold border cursor-pointer transition-colors ${!accountId ? 'bg-accent/20 text-accent border-accent/30' : 'bg-white/5 text-text-secondary border-white/10 hover:text-white'}`}
              >
                All
              </span>
            </Link>
            {accounts.map((acc) => (
              <Link key={acc.id} href={buildFilterUrl({ accountId: acc.id })}>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold border cursor-pointer transition-colors ${accountId === acc.id ? 'bg-accent/20 text-accent border-accent/30' : 'bg-white/5 text-text-secondary border-white/10 hover:text-white'}`}
                >
                  @{acc.username}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-text-secondary font-medium uppercase tracking-wide">
            Status
          </span>
          {statuses.map((s) => (
            <Link key={s} href={buildFilterUrl({ status: status === s ? undefined : s })}>
              <span
                className={`px-2.5 py-0.5 rounded-md text-xs font-bold border cursor-pointer capitalize transition-colors ${status === s ? STATUS_STYLES[s] : 'bg-white/5 text-text-secondary border-white/10 hover:text-white'}`}
              >
                {s}
              </span>
            </Link>
          ))}
        </div>

        {/* Format filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-text-secondary font-medium uppercase tracking-wide">
            Format
          </span>
          {formats.map((f) => (
            <Link key={f} href={buildFilterUrl({ format: format === f ? undefined : f })}>
              <span
                className={`px-2.5 py-0.5 rounded-md text-xs font-medium border cursor-pointer transition-colors ${format === f ? 'bg-accent/20 text-accent border-accent/30' : 'bg-white/5 text-text-secondary border-white/10 hover:text-white'}`}
              >
                {FORMAT_LABELS[f]}
              </span>
            </Link>
          ))}
        </div>
      </Card>

      {/* Table */}
      <div className="glass overflow-hidden">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-white/5 text-text-secondary text-sm font-medium">
              <th className="p-4 pl-6 font-heading">Account</th>
              <th className="p-4 font-heading">Format</th>
              <th className="p-4 font-heading">Status</th>
              <th className="p-4 font-heading">Render</th>
              <th className="p-4 font-heading">Scheduled</th>
              <th className="p-4 font-heading">Created</th>
              <th className="p-4 pr-6 font-heading">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(compositions as CompositionWithRelations[]).map((comp) => (
              <tr
                key={comp.id}
                className="border-b border-white/5 text-sm hover:bg-white/5 transition-colors"
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
                    className={`px-2.5 py-1 rounded-md text-xs font-bold tracking-wide border ${STATUS_STYLES[comp.status] ?? 'bg-white/5 text-text-secondary border-white/10'}`}
                  >
                    {comp.status}
                  </span>
                </td>
                <td className="p-4 text-text-secondary text-xs">
                  {comp.renderJob ? (
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${comp.renderJob.status === 'done' ? 'text-emerald-400' : comp.renderJob.status === 'failed' ? 'text-red-400' : 'text-amber-400'}`}
                    >
                      {comp.renderJob.status}
                      {comp.renderJob.status === 'rendering'
                        ? ` ${Math.round(comp.renderJob.progress)}%`
                        : ''}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="p-4 text-text-secondary text-xs">
                  {comp.scheduledAt
                    ? new Date(comp.scheduledAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—'}
                </td>
                <td className="p-4 text-text-secondary text-xs">
                  {new Date(comp.createdAt).toLocaleDateString()}
                </td>
                <td className="p-4 pr-6">
                  <div className="flex gap-2">
                    {comp.status === 'draft' && (
                      <form action={approveComposition.bind(null, comp.id)}>
                        <Button
                          type="submit"
                          size="sm"
                          className="bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 text-xs h-7 px-2"
                        >
                          Approve
                        </Button>
                      </form>
                    )}
                    <Link href={`/dashboard/compositions/${comp.id}`}>
                      <Button variant="ghost" size="sm" className="text-accent text-xs h-7 px-2">
                        View
                      </Button>
                    </Link>
                    <form action={deleteComposition.bind(null, comp.id)}>
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        className="text-red-500 text-xs h-7 px-2 hover:bg-red-500/10"
                      >
                        Delete
                      </Button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {compositions.length === 0 && (
              <tr>
                <td colSpan={7} className="p-12 text-center">
                  <Clapperboard size={40} className="text-text-secondary opacity-30 mx-auto mb-4" />
                  <p className="text-text-secondary">
                    No compositions found for the selected filters.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {compositions.length === 50 && (
        <p className="text-center text-xs text-text-secondary mt-4">
          Showing the 50 most recent compositions.
        </p>
      )}
    </div>
  )
}

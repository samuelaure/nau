import { prisma } from '@/modules/shared/prisma'
import { Card } from '@/modules/shared/components/ui/Card'
import { Button } from '@/modules/shared/components/ui/Button'
import Link from 'next/link'
import { Lightbulb } from 'lucide-react'
import { approveIdea, rejectIdea } from '@/modules/compositions/actions'

export const dynamic = 'force-dynamic'

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  USED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  REJECTED: 'bg-red-500/10 text-red-400 border-red-500/20',
}

const SOURCE_LABELS: Record<string, string> = {
  inspo: 'InspoItem',
  internal: 'Internal',
  user_input: 'Manual',
  reactive: 'Reactive',
}

const SOURCE_STYLES: Record<string, string> = {
  inspo: 'bg-purple-500/10 text-purple-400',
  internal: 'bg-blue-500/10 text-blue-400',
  user_input: 'bg-indigo-500/10 text-indigo-400',
  reactive: 'bg-orange-500/10 text-orange-400',
}

export default async function IdeasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; source?: string; accountId?: string }>
}) {
  const { status, source, accountId } = await searchParams

  const ideas = await prisma.contentIdea.findMany({
    where: {
      ...(accountId ? { accountId } : {}),
      ...(status ? { status } : {}),
      ...(source ? { source } : {}),
    },
    take: 100,
    orderBy: { createdAt: 'desc' },
    include: {
      account: { select: { id: true, username: true } },
      _count: { select: { compositions: true } },
    },
  })

  const accounts = await prisma.socialAccount.findMany({
    select: { id: true, username: true },
    orderBy: { username: 'asc' },
  })

  const statuses = ['PENDING', 'USED', 'REJECTED']
  const sources = ['inspo', 'internal', 'user_input', 'reactive']

  function buildFilterUrl(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams()
    const merged = { status, source, accountId, ...overrides }
    Object.entries(merged).forEach(([k, v]) => {
      if (v) params.set(k, v)
    })
    const qs = params.toString()
    return `/dashboard/ideas${qs ? `?${qs}` : ''}`
  }

  const pendingCount = ideas.filter((i) => i.status === 'PENDING').length

  return (
    <div className="animate-fade-in">
      <header className="mb-8">
        <h1 className="text-3xl font-heading font-semibold mb-2">Ideas Bank</h1>
        <p className="text-text-secondary">
          All content ideas across accounts.
          {pendingCount > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-xs font-bold">
              {pendingCount} pending
            </span>
          )}
        </p>
      </header>

      {/* Filter Bar */}
      <Card className="mb-8 p-4 flex flex-wrap gap-4 items-start">
        {/* Account */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-text-secondary font-medium uppercase tracking-wide shrink-0">
            Account
          </span>
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

        {/* Status */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-text-secondary font-medium uppercase tracking-wide shrink-0">
            Status
          </span>
          {statuses.map((s) => (
            <Link key={s} href={buildFilterUrl({ status: status === s ? undefined : s })}>
              <span
                className={`px-2.5 py-0.5 rounded-md text-xs font-bold border cursor-pointer transition-colors ${status === s ? STATUS_STYLES[s] : 'bg-white/5 text-text-secondary border-white/10 hover:text-white'}`}
              >
                {s}
              </span>
            </Link>
          ))}
        </div>

        {/* Source */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-text-secondary font-medium uppercase tracking-wide shrink-0">
            Source
          </span>
          {sources.map((s) => (
            <Link key={s} href={buildFilterUrl({ source: source === s ? undefined : s })}>
              <span
                className={`px-2.5 py-0.5 rounded-md text-xs font-medium border cursor-pointer transition-colors ${source === s ? SOURCE_STYLES[s] + ' border-current/30' : 'bg-white/5 text-text-secondary border-white/10 hover:text-white'}`}
              >
                {SOURCE_LABELS[s]}
              </span>
            </Link>
          ))}
        </div>
      </Card>

      {/* Ideas List */}
      {ideas.length === 0 ? (
        <div className="text-center py-24 border border-dashed border-white/10 rounded-xl">
          <Lightbulb size={48} className="text-text-secondary opacity-30 mx-auto mb-4" />
          <h2 className="text-xl font-heading font-semibold mb-2">No Ideas Found</h2>
          <p className="text-text-secondary text-sm">Run the ideation cron or adjust filters.</p>
        </div>
      ) : (
        <div className="glass overflow-hidden">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-white/5 text-text-secondary text-sm font-medium">
                <th className="p-4 pl-6 font-heading">Account</th>
                <th className="p-4 font-heading">Idea</th>
                <th className="p-4 font-heading">Source</th>
                <th className="p-4 font-heading">Status</th>
                <th className="p-4 font-heading">Composed</th>
                <th className="p-4 font-heading">Created</th>
                <th className="p-4 pr-6 font-heading">Actions</th>
              </tr>
            </thead>
            <tbody>
              {ideas.map((idea) => (
                <tr
                  key={idea.id}
                  className={`border-b border-white/5 text-sm hover:bg-white/5 transition-colors ${idea.status === 'REJECTED' ? 'opacity-40' : ''}`}
                >
                  <td className="p-4 pl-6 font-medium text-white shrink-0">
                    @{idea.account?.username ?? '—'}
                  </td>
                  <td className="p-4 max-w-sm">
                    <p className="text-sm text-white line-clamp-2">{idea.ideaText}</p>
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${SOURCE_STYLES[idea.source] ?? 'bg-white/5 text-text-secondary'}`}
                    >
                      {SOURCE_LABELS[idea.source] ?? idea.source}
                    </span>
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-2.5 py-1 rounded-md text-xs font-bold tracking-wide border ${STATUS_STYLES[idea.status] ?? 'bg-white/5 text-text-secondary border-white/10'}`}
                    >
                      {idea.status}
                    </span>
                  </td>
                  <td className="p-4 text-text-secondary text-xs">
                    {idea._count.compositions > 0 ? (
                      <Link
                        href={`/dashboard/compositions?accountId=${idea.accountId}`}
                        className="text-accent hover:text-accent-hover"
                      >
                        {idea._count.compositions} ×
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="p-4 text-text-secondary text-xs">
                    {new Date(idea.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-4 pr-6">
                    {idea.status === 'PENDING' && (
                      <div className="flex gap-2">
                        <form action={approveIdea.bind(null, idea.id)}>
                          <Button
                            type="submit"
                            size="sm"
                            className="bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40 text-xs h-7 px-2"
                          >
                            Use
                          </Button>
                        </form>
                        <form action={rejectIdea.bind(null, idea.id)}>
                          <Button
                            type="submit"
                            variant="ghost"
                            size="sm"
                            className="text-red-500 text-xs h-7 px-2 hover:bg-red-500/10"
                          >
                            Reject
                          </Button>
                        </form>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {ideas.length === 100 && (
        <p className="text-center text-xs text-text-secondary mt-4">
          Showing the 100 most recent ideas.
        </p>
      )}
    </div>
  )
}

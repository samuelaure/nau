import { prisma } from '@/modules/shared/prisma'
import { Card } from '@/modules/shared/components/ui/Card'
import { Button } from '@/modules/shared/components/ui/Button'
import Link from 'next/link'
import { CalendarDays, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'
import { triggerDailyPlan } from '@/modules/compositions/actions'

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

interface PlanPiece {
  id: string
  status: string
  format: string
  scheduledAt: string | null
  caption: string | null
  sceneSummary?: string
}

interface PlanScript {
  ideaId: string
  hook: string
  body: string
  estimatedDuration: string
  notes: string
}

interface PlanAlert {
  type: string
  message: string
}

export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const { date } = await searchParams

  const targetDate = date ? new Date(date) : new Date()
  targetDate.setHours(0, 0, 0, 0)

  const prevDate = new Date(targetDate)
  prevDate.setDate(prevDate.getDate() - 1)

  const nextDate = new Date(targetDate)
  nextDate.setDate(nextDate.getDate() + 1)

  const toDateParam = (d: Date) => d.toISOString().split('T')[0]

  const plans = await prisma.contentPlan.findMany({
    where: {
      date: {
        gte: targetDate,
        lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000),
      },
    },
    include: { account: { select: { id: true, username: true, profileImage: true } } },
    orderBy: { createdAt: 'asc' },
  })

  const isToday = toDateParam(targetDate) === toDateParam(new Date())

  return (
    <div className="animate-fade-in">
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-heading font-semibold mb-2">Daily Plans</h1>
          <p className="text-text-secondary">Content plan for each account.</p>
        </div>
        <form action={triggerDailyPlan}>
          <Button type="submit" className="bg-accent hover:bg-accent/80 text-white">
            Generate Plans Now
          </Button>
        </form>
      </header>

      {/* Date Navigation */}
      <Card className="mb-8 p-4 flex items-center justify-between">
        <Link href={`/dashboard/plans?date=${toDateParam(prevDate)}`}>
          <Button variant="ghost" size="sm" className="flex items-center gap-1">
            <ChevronLeft size={16} /> Prev
          </Button>
        </Link>
        <div className="flex flex-col items-center">
          <p className="text-sm font-heading font-semibold text-white">
            {targetDate.toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
          {isToday && <span className="text-xs text-accent font-semibold mt-0.5">Today</span>}
        </div>
        <Link href={`/dashboard/plans?date=${toDateParam(nextDate)}`}>
          <Button variant="ghost" size="sm" className="flex items-center gap-1">
            Next <ChevronRight size={16} />
          </Button>
        </Link>
      </Card>

      {/* No Plans State */}
      {plans.length === 0 && (
        <div className="text-center py-24 border border-dashed border-white/10 rounded-xl">
          <CalendarDays size={48} className="text-text-secondary opacity-30 mx-auto mb-4" />
          <h2 className="text-xl font-heading font-semibold mb-2">No Plan for This Day</h2>
          <p className="text-text-secondary mb-6 text-sm">
            Click &ldquo;Generate Plans Now&rdquo; to create a content plan for all active accounts.
          </p>
        </div>
      )}

      {/* Plan Cards */}
      <div className="flex flex-col gap-8">
        {plans.map((plan) => {
          const pieces = (plan.pieces as unknown as PlanPiece[]) ?? []
          const scripts = (plan.scripts as unknown as PlanScript[]) ?? []
          const alerts = (plan.pieces as unknown as { alerts?: PlanAlert[] })?.alerts ?? []

          const totalPieces = pieces.length
          const renderedPieces = pieces.filter((p) =>
            ['rendered', 'published', 'scheduled'].includes(p.status),
          ).length
          const publishedPieces = pieces.filter((p) => p.status === 'published').length
          const pendingPieces = pieces.filter((p) =>
            ['draft', 'approved', 'rendering'].includes(p.status),
          ).length

          return (
            <Card key={plan.id} className="p-6">
              {/* Account Header */}
              <div className="flex items-center gap-4 mb-6">
                {plan.account.profileImage ? (
                  <img
                    src={plan.account.profileImage}
                    alt={plan.account.username ?? ''}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-sm">
                    {(plan.account.username ?? '?')[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-heading font-semibold">@{plan.account.username}</h2>
                  <p className="text-xs text-text-secondary">
                    <Link
                      href={`/dashboard/accounts/${plan.account.id}`}
                      className="hover:text-accent transition-colors"
                    >
                      View account
                    </Link>
                  </p>
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-4 gap-3 mb-6">
                {[
                  { label: 'Total', value: totalPieces },
                  { label: 'Rendered', value: renderedPieces, accent: 'text-cyan-400' },
                  { label: 'Published', value: publishedPieces, accent: 'text-emerald-400' },
                  { label: 'Pending', value: pendingPieces, accent: 'text-amber-400' },
                ].map((s) => (
                  <div key={s.label} className="p-3 rounded-lg bg-white/5 text-center">
                    <p className="text-[10px] text-text-secondary uppercase tracking-wide mb-1">
                      {s.label}
                    </p>
                    <p className={`text-xl font-heading font-bold ${s.accent ?? 'text-white'}`}>
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Alerts */}
              {alerts.length > 0 && (
                <div className="flex flex-col gap-2 mb-6">
                  {alerts.map((alert, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs"
                    >
                      <AlertTriangle size={12} className="shrink-0" />
                      {alert.message}
                    </div>
                  ))}
                </div>
              )}

              {/* Pieces List */}
              {pieces.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">
                    Content Pieces
                  </h3>
                  <div className="flex flex-col gap-2">
                    {pieces.map((piece) => (
                      <div
                        key={piece.id}
                        className="flex items-center gap-3 p-2.5 rounded-lg bg-white/3 hover:bg-white/5 transition-colors"
                      >
                        <span
                          className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${STATUS_STYLES[piece.status] ?? 'bg-white/5 text-text-secondary'}`}
                        >
                          {piece.status}
                        </span>
                        <span className="text-xs text-text-secondary shrink-0">
                          {FORMAT_LABELS[piece.format] ?? piece.format}
                        </span>
                        {piece.scheduledAt && (
                          <span className="text-xs text-text-secondary ml-auto shrink-0">
                            {new Date(piece.scheduledAt).toLocaleTimeString(undefined, {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                        <Link
                          href={`/dashboard/compositions/${piece.id}`}
                          className="ml-auto shrink-0"
                        >
                          <span className="text-xs text-accent hover:text-accent-hover font-semibold">
                            →
                          </span>
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Scripts */}
              {scripts.length > 0 && (
                <details className="group">
                  <summary className="cursor-pointer text-xs font-semibold text-text-secondary hover:text-white uppercase tracking-wide flex items-center gap-2 select-none list-none">
                    <span className="group-open:rotate-90 transition-transform inline-block">
                      ›
                    </span>
                    Recording Scripts ({scripts.length})
                  </summary>
                  <div className="flex flex-col gap-4 mt-4">
                    {scripts.map((script, i) => (
                      <div
                        key={script.ideaId ?? i}
                        className="p-4 rounded-lg bg-white/3 border border-white/5"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-text-secondary font-semibold uppercase tracking-wide">
                            Script {i + 1}
                          </p>
                          <span className="text-xs text-text-secondary">
                            {script.estimatedDuration}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-white mb-1">{script.hook}</p>
                        <p className="text-sm text-text-secondary whitespace-pre-wrap">
                          {script.body}
                        </p>
                        {script.notes && (
                          <p className="text-xs text-text-secondary italic mt-2 border-t border-white/5 pt-2">
                            {script.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

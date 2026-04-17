import { prisma } from '@/modules/shared/prisma'
import { Button } from '@/modules/shared/components/ui/Button'
import { triggerDailyPlan } from '@/modules/compositions/actions'
import DailyScheduleView from '@/modules/plans/components/DailyScheduleView'

export const dynamic = 'force-dynamic'

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

  // Map plans to AccountPlan for DailyScheduleView
  const mappedPlans = plans.map((plan) => {
    const pieces = (plan.pieces as unknown as PlanPiece[]) ?? []
    const planAlerts = (plan.pieces as unknown as { alerts?: PlanAlert[] })?.alerts ?? []

    // Simulated or derived slots based on pieces or the brand's postingSchedule
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

    return {
      accountId: plan.account.id,
      username: plan.account.username || 'Unknown',
      profileImage: plan.account.profileImage,
      alerts: planAlerts,
      slots,
      pieces,
    }
  })

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
        plans={mappedPlans}
        context="global"
        basePath="/dashboard/plans"
      />
    </div>
  )
}

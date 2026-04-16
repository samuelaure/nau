'use client'

import React from 'react'
import { Card } from '@/modules/shared/components/ui/Card'
import { Button } from '@/modules/shared/components/ui/Button'
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertTriangle,
  Video,
  Image as ImageIcon,
  Layers,
} from 'lucide-react'
import { cn } from '@/modules/shared/utils'

interface Slot {
  time: string
  type: string
  status: string
  compositionId: string | null
}

interface PlanAlert {
  type: string
  message: string
}

interface Piece {
  id: string
  status: string
  format: string
  scheduledAt: string | null
}

interface AccountPlan {
  accountId: string
  username: string
  profileImage: string | null
  alerts: PlanAlert[]
  slots: Slot[]
  pieces: Piece[] // Raw pieces if needed
}

interface DailyScheduleViewProps {
  dateParam: string // ISO string date
  prevDateParam: string
  nextDateParam: string
  formattedDate: string
  isToday: boolean
  plans: AccountPlan[]
  context: 'global' | 'brand'
  basePath: string // '/dashboard/plans' or '/dashboard/workspace/.../account/...'
}

const FORMAT_ICONS: Record<string, React.ReactNode> = {
  reel: <Video size={14} />,
  trial_reel: <Video size={14} />,
  carousel: <Layers size={14} />,
  single_image: <ImageIcon size={14} />,
}

export default function DailyScheduleView({
  dateParam: _dateParam,
  prevDateParam,
  nextDateParam,
  formattedDate,
  isToday,
  plans,
  context,
  basePath,
}: DailyScheduleViewProps) {
  return (
    <div className="flex flex-col gap-8 w-full">
      {/* Date Navigation */}
      <Card className="p-4 flex items-center justify-between">
        <a href={`${basePath}?date=${prevDateParam}`}>
          <Button variant="ghost" size="sm" className="flex items-center gap-1">
            <ChevronLeft size={16} /> Prev
          </Button>
        </a>
        <div className="flex flex-col items-center">
          <p className="text-sm font-heading font-semibold text-white">{formattedDate}</p>
          {isToday && <span className="text-xs text-accent font-semibold mt-0.5">Today</span>}
        </div>
        <a href={`${basePath}?date=${nextDateParam}`}>
          <Button variant="ghost" size="sm" className="flex items-center gap-1">
            Next <ChevronRight size={16} />
          </Button>
        </a>
      </Card>

      {/* Plans List */}
      {plans.length === 0 ? (
        <div className="text-center py-24 border border-dashed border-white/10 rounded-xl">
          <Clock size={48} className="text-text-secondary opacity-30 mx-auto mb-4" />
          <h2 className="text-xl font-heading font-semibold mb-2">No Schedule for This Day</h2>
          <p className="text-text-secondary mb-6 text-sm">
            Generate a plan or manually assign slots.
          </p>
        </div>
      ) : (
        plans.map((plan) => (
          <Card key={plan.accountId} className="p-6">
            {/* Header (Only show if global) */}
            {context === 'global' && (
              <div className="flex items-center gap-4 mb-6 pb-4 border-b border-white/5">
                {plan.profileImage ? (
                  <img
                    src={plan.profileImage}
                    alt={plan.username}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-xs">
                    {plan.username[0]?.toUpperCase()}
                  </div>
                )}
                <div>
                  <h2 className="text-base font-heading font-semibold">@{plan.username}</h2>
                </div>
              </div>
            )}

            {/* Alerts */}
            {plan.alerts.length > 0 && (
              <div className="flex flex-col gap-2 mb-6">
                {plan.alerts.map((alert, i) => (
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

            {/* Slots */}
            {plan.slots.length === 0 ? (
              <p className="text-sm text-text-secondary italic">No slots defined for this day.</p>
            ) : (
              <div className="grid gap-3">
                {plan.slots.map((slot, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/5"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5 text-accent bg-accent/10 px-2 py-1 rounded text-sm">
                        <Clock size={14} />
                        <span className="font-bold font-mono">{slot.time}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1 mb-0.5">
                          {FORMAT_ICONS[slot.type.toLowerCase().replace(' ', '_')] || (
                            <Video size={12} />
                          )}
                          {slot.type}
                        </span>
                        <p className="text-sm font-semibold text-white">
                          {slot.compositionId
                            ? `Composition #${slot.compositionId}`
                            : 'Unassigned Slot'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          'px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide',
                          slot.status.toLowerCase() === 'published'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : slot.status.toLowerCase() === 'scheduled'
                              ? 'bg-blue-500/10 text-blue-400'
                              : 'bg-white/5 text-text-secondary',
                        )}
                      >
                        {slot.status}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs px-2 h-7 opacity-50 hover:opacity-100"
                      >
                        Edit
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))
      )}
    </div>
  )
}

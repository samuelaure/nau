import { useState, useEffect } from 'react'
import { Card } from '@/modules/shared/components/ui/Card'
import { Button } from '@/modules/shared/components/ui/Button'
import { Input } from '@/modules/shared/components/ui/Input'
import { toast } from 'sonner'
import { CalendarClock, Loader2 } from 'lucide-react'

export default function AccountSchedulerSettings({ accountId }: { accountId: string }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [frequency, setFrequency] = useState<number>(1)
  const [lastPosted, setLastPosted] = useState<string | null>(null)

  const fetchSchedule = async () => {
    try {
      const res = await fetch(`/api/schedule?accountId=${accountId}`)
      const data = await res.json()
      if (data.schedule) {
        setFrequency(data.schedule.frequencyDays)
        setLastPosted(data.schedule.lastPostedAt)
      }
    } catch {
      toast.error('Failed to load scheduler settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSchedule()
  }, [accountId])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, frequencyDays: Number(frequency) }),
      })
      if (!res.ok) throw new Error()
      toast.success('Publishing schedule updated!')
    } catch {
      toast.error('Failed to update schedule')
    } finally {
      setSaving(false)
    }
  }

  const triggerWorkerLocally = async () => {
    const toastId = toast.loading('Triggering worker manually...')
    try {
      const res = await fetch('/api/cron/publisher')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Worker failed')
      toast.success(data.message || 'Worker finished successfully!', { id: toastId })
      fetchSchedule()
    } catch (e: any) {
      toast.error(`Worker error: ${e.message}`, { id: toastId })
    }
  }

  return (
    <Card className="p-8 border-gray-800 bg-gray-900">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-heading font-semibold flex items-center gap-2">
          <CalendarClock className="w-5 h-5 text-accent" />
          Autonomous Publishing Schedule
        </h3>
        <Button
          onClick={triggerWorkerLocally}
          variant="outline"
          className="border-accent text-accent hover:bg-accent/10"
        >
          Force Worker Run
        </Button>
      </div>

      {!loading ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col md:flex-row gap-4 md:items-end">
            <div className="flex-1">
              <label className="text-sm text-gray-400 block mb-1">
                Frequency (Days between posts)
              </label>
              <Input
                type="number"
                min="1"
                value={frequency}
                onChange={(e) => setFrequency(Number(e.target.value))}
                className="bg-gray-950 border-gray-800 text-white"
              />
              <p className="text-xs text-gray-500 mt-2">
                The global worker polls this account. If current time &gt; Last Posted + Frequency,
                the worker grabs your oldest APPROVED Composition, renders it on Remotion, and
                pushes it directly to Instagram.
              </p>
            </div>

            <Button
              onClick={handleSave}
              disabled={saving}
              className="whitespace-nowrap w-full md:w-auto"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Frequency'}
            </Button>
          </div>

          <div className="p-4 bg-gray-950 rounded border border-gray-800 flex justify-between items-center">
            <span className="text-sm text-gray-400">Last Automatically Posted At:</span>
            <span className="font-mono text-sm max-w-full truncate">
              {lastPosted ? new Date(lastPosted).toLocaleString() : 'Never'}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center p-4">
          <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
        </div>
      )}
    </Card>
  )
}

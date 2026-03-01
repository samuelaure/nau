'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/modules/shared/components/ui/Card'
import { Button } from '@/modules/shared/components/ui/Button'
import { toast } from 'sonner'
import { Loader2, Trash2, CheckCircle2 } from 'lucide-react'
import dynamic from 'next/dynamic'

const DynamicCompositionMock = dynamic(
  () =>
    import('@/modules/rendering/DynamicCompositionMock/DynamicCompositionMock').then(
      (mod) => mod.DynamicCompositionMock,
    ),
  { ssr: false },
)
import { Player } from '@remotion/player'

export default function AccountDrafts({ accountId }: { accountId: string }) {
  const [compositions, setCompositions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchCompositions = async () => {
    try {
      const res = await fetch(`/api/compositions?accountId=${accountId}`)
      const data = await res.json()
      setCompositions(data.compositions || [])
    } catch {
      toast.error('Failed to load compositions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCompositions()
  }, [accountId])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this composition?')) return
    try {
      await fetch(`/api/compositions/${id}`, { method: 'DELETE' })
      setCompositions(compositions.filter((c) => c.id !== id))
    } catch {
      toast.error('Failed to delete composition')
    }
  }

  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`/api/compositions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED' }),
      })
      if (!res.ok) throw new Error()
      toast.success('Approved for Publishing!')
      fetchCompositions()
    } catch {
      toast.error('Failed to approve composition')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-heading font-semibold">Composition Drafts</h3>
      </div>

      {!loading && compositions.length === 0 && (
        <div className="text-center py-10 text-text-secondary border border-dashed border-gray-800 rounded-lg">
          No generated compositions yet. Approve ideas from your Backlog to generate them here.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {compositions.map((comp) => {
          const isDraft = comp.status === 'DRAFT'
          const isApproved = comp.status === 'APPROVED'

          return (
            <Card
              key={comp.id}
              className={`bg-gray-900 border ${isApproved ? 'border-green-900' : 'border-gray-800'} p-4 flex flex-col gap-4`}
            >
              <div className="flex justify-between items-center">
                <span
                  className={`text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-full uppercase ${isDraft ? 'bg-orange-900 text-orange-400' : isApproved ? 'bg-green-900 text-green-400' : 'bg-gray-800 text-gray-400'}`}
                >
                  {comp.status}
                </span>
                <span className="text-xs text-gray-500">
                  Template: {comp.template?.name || 'Unknown'}
                </span>
              </div>

              {/* Remotion Preview */}
              <div className="w-full aspect-[9/16] bg-black rounded-lg overflow-hidden relative shadow-lg">
                <Player
                  component={DynamicCompositionMock as any}
                  inputProps={{ schema: comp.payload }}
                  durationInFrames={Math.max(1, comp.payload?.durationInFrames || 150)}
                  fps={Math.max(1, comp.payload?.fps || 30)}
                  compositionWidth={Math.max(1, comp.payload?.width || 1080)}
                  compositionHeight={Math.max(1, comp.payload?.height || 1920)}
                  style={{
                    width: '100%',
                    height: '100%',
                  }}
                  controls
                  loop
                />
              </div>

              <div className="flex gap-2">
                {isDraft && (
                  <Button
                    onClick={() => handleApprove(comp.id)}
                    className="w-full bg-accent hover:bg-accent/80 flex items-center gap-2 justify-center"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Approve
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => handleDelete(comp.id)}
                  className="border-gray-700 hover:bg-gray-800 px-3"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

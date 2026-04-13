import { prisma } from '@/modules/shared/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Play } from 'lucide-react'
import { Card } from '@/modules/shared/components/ui/Card'
import { Button } from '@/modules/shared/components/ui/Button'
import {
  approveComposition,
  deleteComposition,
  requeueRender,
} from '@/modules/compositions/actions'

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

const SOURCE_LABELS: Record<string, string> = {
  inspo: 'nauthenticity InspoItem',
  internal: 'Internal Generation',
  user_input: 'Manual Input',
  reactive: 'Reactive Trigger',
}

export default async function CompositionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const comp = await prisma.composition.findUnique({
    where: { id },
    include: {
      account: { select: { id: true, username: true } },
      renderJob: true,
      idea: { select: { id: true, ideaText: true, source: true, sourceRef: true } },
    },
  })

  if (!comp) return notFound()

  const canApprove = comp.status === 'draft'
  const canRequeue = ['rendered', 'failed'].includes(comp.status)
  const renderTimeMin = comp.renderJob?.renderTimeMs
    ? `${(comp.renderJob.renderTimeMs / 60000).toFixed(1)} min`
    : null

  return (
    <div className="animate-fade-in max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-text-secondary mb-6 text-sm">
        <Link href="/dashboard/compositions" className="hover:text-white transition-colors">
          Compositions
        </Link>
        <ChevronRight size={16} />
        <span className="text-white font-mono text-xs">{comp.id}</span>
      </div>

      {/* Header */}
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide ${STATUS_STYLES[comp.status] ?? 'bg-white/5 text-text-secondary'}`}
            >
              {comp.status.toUpperCase()}
            </span>
            <span className="px-2.5 py-0.5 rounded text-xs bg-white/5 text-text-secondary font-medium">
              {FORMAT_LABELS[comp.format] ?? comp.format}
            </span>
          </div>
          <h1 className="text-2xl font-heading font-semibold text-white">
            @{comp.account?.username ?? '—'}
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Created {new Date(comp.createdAt).toLocaleString()}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 shrink-0">
          {canApprove && (
            <form action={approveComposition.bind(null, comp.id)}>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
                Approve
              </Button>
            </form>
          )}
          {canRequeue && (
            <form action={requeueRender.bind(null, comp.id)}>
              <Button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white">
                Re-queue Render
              </Button>
            </form>
          )}
          <form action={deleteComposition.bind(null, comp.id)}>
            <Button
              type="submit"
              variant="outline"
              className="border-red-800 text-red-500 hover:bg-red-950"
            >
              Delete
            </Button>
          </form>
        </div>
      </header>

      <div className="flex flex-col gap-6">
        {/* Video / Image Preview */}
        {(comp.videoUrl || comp.coverUrl) && (
          <Card className="p-4">
            <h2 className="text-sm font-heading font-semibold text-text-secondary uppercase tracking-wide mb-4">
              Preview
            </h2>
            {comp.videoUrl ? (
              <video
                src={comp.videoUrl}
                controls
                className="w-full max-w-sm rounded-lg aspect-[9/16] bg-black object-contain mx-auto block"
              />
            ) : comp.coverUrl ? (
              <img
                src={comp.coverUrl}
                alt="Composition cover"
                className="w-full max-w-sm rounded-lg mx-auto block object-cover"
              />
            ) : null}
          </Card>
        )}

        {/* Render Job */}
        {comp.renderJob && (
          <Card className="p-4">
            <h2 className="text-sm font-heading font-semibold text-text-secondary uppercase tracking-wide mb-4">
              Render Job
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-text-secondary mb-1">Status</p>
                <p
                  className={`text-sm font-bold capitalize ${comp.renderJob.status === 'done' ? 'text-emerald-400' : comp.renderJob.status === 'failed' ? 'text-red-400' : 'text-amber-400'}`}
                >
                  {comp.renderJob.status}
                </p>
              </div>
              <div>
                <p className="text-xs text-text-secondary mb-1">Progress</p>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all"
                      style={{ width: `${comp.renderJob.progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-text-secondary">
                    {Math.round(comp.renderJob.progress)}%
                  </span>
                </div>
              </div>
              <div>
                <p className="text-xs text-text-secondary mb-1">Attempts</p>
                <p className="text-sm font-medium">
                  {comp.renderJob.attempts} / {comp.renderJob.maxAttempts}
                </p>
              </div>
              {renderTimeMin && (
                <div>
                  <p className="text-xs text-text-secondary mb-1">Render Time</p>
                  <p className="text-sm font-medium">{renderTimeMin}</p>
                </div>
              )}
            </div>
            {comp.renderJob.error && (
              <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-xs text-red-400 font-mono">{comp.renderJob.error}</p>
              </div>
            )}
            {comp.renderJob.outputUrl && (
              <div className="mt-4">
                <a
                  href={comp.renderJob.outputUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-accent hover:text-accent-hover font-semibold"
                >
                  <Play size={14} /> View Rendered Output
                </a>
              </div>
            )}
          </Card>
        )}

        {/* Caption & Hashtags */}
        {(comp.caption || (comp.hashtags && comp.hashtags.length > 0)) && (
          <Card className="p-4">
            <h2 className="text-sm font-heading font-semibold text-text-secondary uppercase tracking-wide mb-4">
              Caption & Hashtags
            </h2>
            {comp.caption && (
              <p className="text-sm text-white whitespace-pre-wrap mb-4">{comp.caption}</p>
            )}
            {comp.hashtags && comp.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {comp.hashtags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded bg-accent/10 text-accent text-xs font-medium"
                  >
                    {tag.startsWith('#') ? tag : `#${tag}`}
                  </span>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Source Idea */}
        {comp.idea && (
          <Card className="p-4">
            <h2 className="text-sm font-heading font-semibold text-text-secondary uppercase tracking-wide mb-4">
              Source Idea
            </h2>
            <div className="flex items-start gap-3">
              <span className="shrink-0 px-2 py-0.5 rounded bg-white/5 text-text-secondary text-xs font-medium mt-0.5">
                {SOURCE_LABELS[comp.idea.source] ?? comp.idea.source}
              </span>
              <p className="text-sm text-white whitespace-pre-wrap">{comp.idea.ideaText}</p>
            </div>
            {comp.idea.sourceRef && (
              <p className="text-xs text-text-secondary mt-2">Ref: {comp.idea.sourceRef}</p>
            )}
          </Card>
        )}

        {/* Scheduling */}
        {(comp.scheduledAt || comp.publishAttempts > 0 || comp.lastPublishError) && (
          <Card className="p-4">
            <h2 className="text-sm font-heading font-semibold text-text-secondary uppercase tracking-wide mb-4">
              Publishing
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-text-secondary mb-1">Scheduled At</p>
                <p className="text-sm font-medium">
                  {comp.scheduledAt ? new Date(comp.scheduledAt).toLocaleString() : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-text-secondary mb-1">Publish Attempts</p>
                <p className="text-sm font-medium">{comp.publishAttempts}</p>
              </div>
            </div>
            {comp.lastPublishError && (
              <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-xs text-red-400 font-mono">{comp.lastPublishError}</p>
              </div>
            )}
          </Card>
        )}

        {/* Creative Direction */}
        {comp.creative && (
          <Card className="p-4">
            <h2 className="text-sm font-heading font-semibold text-text-secondary uppercase tracking-wide mb-4">
              Creative Direction (AI Output)
            </h2>
            <pre className="text-xs text-text-secondary overflow-x-auto bg-black/40 p-4 rounded-lg font-mono leading-relaxed whitespace-pre-wrap break-all">
              {JSON.stringify(comp.creative, null, 2)}
            </pre>
          </Card>
        )}

        {/* Payload */}
        <details className="group">
          <summary className="cursor-pointer text-sm text-text-secondary hover:text-white transition-colors list-none flex items-center gap-2 select-none">
            <span className="group-open:rotate-90 transition-transform inline-block">›</span>
            View Compiled Payload (DynamicCompositionSchema)
          </summary>
          <Card className="p-4 mt-3">
            <pre className="text-xs text-text-secondary overflow-x-auto bg-black/40 p-4 rounded-lg font-mono leading-relaxed whitespace-pre-wrap break-all">
              {JSON.stringify(comp.payload, null, 2)}
            </pre>
          </Card>
        </details>
      </div>
    </div>
  )
}

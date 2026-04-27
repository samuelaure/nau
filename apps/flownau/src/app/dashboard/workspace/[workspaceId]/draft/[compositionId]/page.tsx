import { prisma } from '@/modules/shared/prisma'
import { notFound } from 'next/navigation'
import DraftEditor from './DraftEditor'

export const dynamic = 'force-dynamic'

export default async function DraftDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string; compositionId: string }>
  searchParams: Promise<{ brandId?: string }>
}) {
  const { workspaceId, compositionId } = await params
  const { brandId } = await searchParams

  const composition = await prisma.post.findUnique({
    where: { id: compositionId },
    include: {
      template: { select: { name: true } },
    },
  })

  if (!composition) notFound()

  const backUrl = `/dashboard/workspace/${workspaceId}?brandId=${brandId}&tab=pool`

  return (
    <div className="animate-fade-in px-4 py-6 max-w-2xl mx-auto">
      <DraftEditor
        composition={{
          id: composition.id,
          status: composition.status,
          format: composition.format ?? null,
          caption: composition.caption,
          hashtags: composition.hashtags,
          creative: composition.creative,
          idea: { ideaText: composition.ideaText },
          template: composition.template,
        }}
        backUrl={backUrl}
      />
    </div>
  )
}

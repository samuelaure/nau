import { prisma } from '@/modules/shared/prisma'
import { notFound } from 'next/navigation'
import TemplateDetailClient from './TemplateDetailClient'

export const dynamic = 'force-dynamic'

export default async function TemplateDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string; templateId: string }>
  searchParams: Promise<{ brandId?: string }>
}) {
  const { workspaceId, templateId } = await params
  const { brandId } = await searchParams

  const template = await prisma.template.findUnique({
    where: { id: templateId },
    include: { _count: { select: { compositions: true } } },
  })

  if (!template) notFound()

  const backUrl = `/dashboard/workspace/${workspaceId}?brandId=${brandId}&tab=templates`

  return (
    <div className="animate-fade-in px-4 py-6">
      <TemplateDetailClient
        template={{
          id: template.id,
          name: template.name,
          remotionId: template.remotionId,
          sceneType: template.sceneType,
          scope: template.scope,
          systemPrompt: template.systemPrompt,
          contentSchema: template.contentSchema,
          useBrandAssets: template.useBrandAssets,
          _count: template._count,
        }}
        backUrl={backUrl}
      />
    </div>
  )
}

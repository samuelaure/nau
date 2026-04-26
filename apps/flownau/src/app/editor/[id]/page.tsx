export const dynamic = 'force-dynamic'

import { prisma } from '@/modules/shared/prisma'
import { notFound } from 'next/navigation'
import ClientEditor from './ClientEditor'
import { VideoTemplate, Asset } from '@/types/video-schema'

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const template = await prisma.template.findUnique({
    where: { id },
    include: {
      brand: {
        include: {
          assets: true,
        },
      },
      assets: true,
    },
  })

  if (!template) notFound()

  // Combine assets: template assets first, then brand assets
  const combinedAssets = [
    ...template.assets,
    ...(template.useBrandAssets && template.brand ? template.brand.assets : []),
  ] as Asset[]

  const assetsRoot =
    template.useBrandAssets && template.brand?.assetsRoot
      ? template.brand.assetsRoot
      : template.assetsRoot

  const initialConfig = template.config ? (template.config as unknown as VideoTemplate) : undefined

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-background">
      <ClientEditor
        templateId={id}
        templateName={template.name}
        initialConfig={initialConfig as VideoTemplate}
        assets={combinedAssets}
        assetsRoot={assetsRoot || undefined}
      />
    </div>
  )
}

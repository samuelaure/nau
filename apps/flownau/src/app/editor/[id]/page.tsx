
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import ClientEditor from './ClientEditor'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    const template = await prisma.template.findUnique({
        where: { id },
        include: {
            account: {
                include: {
                    assets: true
                }
            },
            assets: true
        }
    })

    if (!template) notFound()

    // Combine assets: template assets first, then account assets
    const combinedAssets = [
        ...template.assets,
        ...(template.useAccountAssets && template.account ? template.account.assets : [])
    ]

    return (
        <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#0d0d0d' }}>
            <ClientEditor
                templateId={id}
                templateName={template.name}
                initialConfig={(template.config as any) || undefined}
                assets={combinedAssets}
            />
        </div>
    )
}


import { prisma } from '@/modules/shared/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, LayoutTemplate, Settings, Video } from 'lucide-react'
import AssetsManager from '@/modules/shared/components/AssetsManager'
import TemplateSettings from '@/modules/video/components/TemplateSettings'

export default async function TemplatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string; from?: string }>
}) {
  const { id } = await params
  const { tab, from } = await searchParams
  const activeTab = tab || 'overview'

  const [template, accounts] = await Promise.all([
    prisma.template.findUnique({
      where: { id },
      include: {
        account: true,
        _count: {
          select: { renders: true, assets: true },
        },
      },
    }),
    prisma.user.findFirst().then((user) =>
      user
        ? prisma.socialAccount.findMany({
            where: { userId: user.id },
          })
        : [],
    ),
  ])

  if (!template) notFound()

  return (
    <div className="animate-fade-in">
      {/* Breadcrumb */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: 'var(--text-secondary)',
          marginBottom: '24px',
          fontSize: '14px',
        }}
      >
        <Link
          href={
            from === 'account' && template.accountId
              ? `/dashboard/accounts/${template.accountId}`
              : '/dashboard/templates'
          }
          style={{ color: 'inherit', textDecoration: 'none' }}
        >
          {from === 'account' ? 'Account' : 'Templates'}
        </Link>
        <ChevronRight size={16} />
        <span style={{ color: 'white' }}>{template.name}</span>
      </div>

      {/* Header */}
      <header style={{ marginBottom: '40px', display: 'flex', gap: '24px', alignItems: 'center' }}>
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '16px',
            background: '#27272a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--border-color)',
          }}
        >
          <LayoutTemplate size={40} style={{ color: 'var(--accent-color)' }} />
        </div>
        <div>
          <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>{template.name}</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            {template.account
              ? `Linked to ${template.account.username?.startsWith('@') ? '' : '@'}${template.account.username || 'Unknown'}`
              : 'Global Template'}{' '}
            • {template.remotionId}
          </p>
        </div>
      </header>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color)',
          marginBottom: '32px',
        }}
      >
        <Link
          href={`/editor/${id}`}
          style={{
            padding: '12px 24px',
            textDecoration: 'none',
            color: 'var(--text-secondary)',
            borderBottom: '2px solid transparent',
            marginBottom: '-1px',
            fontWeight: '400',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          Editor <ChevronRight size={12} />
        </Link>
        <TabLink
          href={`/dashboard/templates/${id}?tab=overview`}
          active={activeTab === 'overview'}
          label="Overview"
        />
        <TabLink
          href={`/dashboard/templates/${id}?tab=assets`}
          active={activeTab === 'assets'}
          label="Assets"
          count={template._count.assets}
        />
        <TabLink
          href={`/dashboard/templates/${id}?tab=settings`}
          active={activeTab === 'settings'}
          label="Settings"
        />
      </div>

      {/* Content */}
      {activeTab === 'overview' && (
        <div>
          <p>Analysis/Stats placeholder...</p>
          {/* Reuse render list or similar here later */}
        </div>
      )}

      {activeTab === 'assets' && <TemplateAssets templateId={id} />}

      {activeTab === 'settings' && <TemplateSettings template={template} accounts={accounts} />}
    </div>
  )
}

function TabLink({
  href,
  active,
  label,
  count,
}: {
  href: string
  active: boolean
  label: string
  count?: number
}) {
  return (
    <Link
      href={href}
      style={{
        padding: '12px 24px',
        textDecoration: 'none',
        color: active ? 'white' : 'var(--text-secondary)',
        borderBottom: active ? '2px solid var(--accent-color)' : '2px solid transparent',
        marginBottom: '-1px',
        fontWeight: active ? '600' : '400',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      {label}
      {count !== undefined && (
        <span
          style={{
            background: active ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '12px',
          }}
        >
          {count}
        </span>
      )}
    </Link>
  )
}

async function TemplateAssets({ templateId }: { templateId: string }) {
  const template = await prisma.template.findUnique({
    where: { id: templateId },
    include: { account: true },
  })

  const assets = await prisma.asset.findMany({
    where: { templateId },
    orderBy: { createdAt: 'desc' },
  })

  let basePath = ''
  if (template?.assetsRoot) {
    basePath = template.assetsRoot
  } else if (template?.account?.assetsRoot) {
    basePath = template.account.assetsRoot
  } else if (template?.account) {
    basePath = template.account.username || template.account.id
  } else {
    basePath = 'templates/global'
  }

  return (
    <AssetsManager ownerId={templateId} ownerType="template" assets={assets} basePath={basePath} />
  )
}

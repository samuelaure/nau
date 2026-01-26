import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Instagram } from 'lucide-react'
import AssetsManager from '@/components/AssetsManager'
import AddTemplateButton from '@/app/dashboard/templates/AddTemplateButton'
import AccountSettings from '@/components/AccountSettings'
import TemplateCard from '@/components/TemplateCard'

export default async function AccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id } = await params
  const { tab } = await searchParams
  const activeTab = tab || 'templates'

  const account = await prisma.socialAccount.findUnique({
    where: { id },
    include: {
      _count: {
        select: { templates: true, assets: true },
      },
    },
  })

  if (!account) notFound()

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
        <Link href="/dashboard/accounts" style={{ color: 'inherit', textDecoration: 'none' }}>
          Accounts
        </Link>
        <ChevronRight size={16} />
        <span style={{ color: 'white' }}>{account.username}</span>
      </div>

      {/* Header */}
      <header
        style={{
          marginBottom: '40px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}
      >
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background:
                'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
              padding: '3px',
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                background: 'var(--panel-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Instagram size={40} />
            </div>
          </div>
          <div>
            <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>{account.username}</h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              Instagram Business Account • {account.platformId}
            </p>
          </div>
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
        <TabLink
          href={`/dashboard/accounts/${id}?tab=templates`}
          active={activeTab === 'templates'}
          label="Templates"
          count={account._count.templates}
        />
        <TabLink
          href={`/dashboard/accounts/${id}?tab=assets`}
          active={activeTab === 'assets'}
          label="Assets"
          count={account._count.assets}
        />
        <TabLink
          href={`/dashboard/accounts/${id}?tab=settings`}
          active={activeTab === 'settings'}
          label="Settings"
        />
      </div>

      {/* Content */}
      {activeTab === 'templates' && <AccountTemplates accountId={id} />}
      {activeTab === 'assets' && <AccountAssets accountId={id} />}
      {activeTab === 'settings' && <AccountSettings account={account} />}
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

async function AccountTemplates({ accountId }: { accountId: string }) {
  const templates = await prisma.template.findMany({
    where: { accountId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { renders: true } } },
  })

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
        }}
      >
        <h3 style={{ fontSize: '20px' }}>Attached Templates</h3>
        <AddTemplateButton
          label="Create Template"
          accounts={[{ id: accountId, username: 'Current Account', platform: 'Instagram' }]}
          defaultAccountId={accountId}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
          gap: '24px',
        }}
      >
        {templates.map((template: any) => (
          <TemplateCard key={template.id} template={template} context="account" />
        ))}
      </div>
      {templates.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
          No templates attached to this account.
        </div>
      )}
    </div>
  )
}

async function AccountAssets({ accountId }: { accountId: string }) {
  const account = await prisma.socialAccount.findUnique({
    where: { id: accountId },
    select: { username: true, id: true },
  })

  const assets = await prisma.asset.findMany({
    where: { accountId },
    orderBy: { createdAt: 'desc' },
  })

  const basePath = account?.username || account?.id || ''

  return <AssetsManager ownerId={accountId} ownerType="account" assets={assets} basePath={basePath} />
}

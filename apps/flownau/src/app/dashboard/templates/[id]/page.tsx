import { prisma } from '@/modules/shared/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, LayoutTemplate, Settings, Video } from 'lucide-react'
import AssetsManager from '@/modules/shared/components/AssetsManager'
import TemplateSettings from '@/modules/video/components/TemplateSettings'
import AIBuilderTab from '@/modules/video/components/AIBuilderTab'

export default async function TemplatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string; from?: string }>
}) {
  const { id } = await params
  const { tab, from } = await searchParams
  const activeTab = tab || 'builder'

  const [template, accounts, combinedAssetsCount] = await Promise.all([
    prisma.template.findUnique({
      where: { id },
      include: {
        account: true,
        _count: {
          select: { renders: true, assets: true },
        },
      },
    }),
    prisma.user
      .findFirst()
      .then((user) =>
        user
          ? prisma.socialAccount.findMany({
            where: { userId: user.id },
            select: { id: true, username: true, platform: true },
          })
          : [],
      )
      .then((accounts) =>
        accounts.map((acc) => ({
          ...acc,
          username: acc.username || '',
        })),
      ),
    prisma.asset.count({
      where: {
        OR: [
          { templateId: id },
          // We can't use template.accountId here yet in Promise.all, so we'll fetch it after or use a nested query
        ]
      }
    })
  ])

  // Refined approach: fetch asset count after we know template settings
  if (!template) notFound()

  const trueAssetsCount = await prisma.asset.count({
    where: {
      AND: [
        {
          OR: [
            { templateId: template.id },
            ...(template.useAccountAssets && template.accountId ? [{ accountId: template.accountId }] : [])
          ]
        },
        {
          NOT: {
            OR: [
              { r2Key: { contains: '/outputs/' } },
              { r2Key: { contains: '/Outputs/' } },
              { url: { contains: '/outputs/' } },
              { url: { contains: '/Outputs/' } }
            ]
          }
        }
      ]
    }
  })

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
            {template.account && template.account.username
              ? `Linked to ${template.account.username.startsWith('@') ? '' : '@'}${template.account.username}`
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
        <TabLink
          href={`/dashboard/templates/${id}?tab=builder`}
          active={activeTab === 'builder'}
          label="AI Builder"
        />
        {/* TODO: The editor feature is meant to serve as a 'create from scratch' process as well as edit current template 'manually' option and as 'create a specific video manually' (full capabilities of a video editor). Just a standard visual template/video editor. */}
        <TabLink
          href={`/dashboard/templates/${id}?tab=overview`}
          active={activeTab === 'overview'}
          label="Overview"
        />
        <TabLink
          href={`/dashboard/templates/${id}?tab=assets`}
          active={activeTab === 'assets'}
          label="Assets"
          count={trueAssetsCount}
        />
        <TabLink
          href={`/dashboard/templates/${id}?tab=settings`}
          active={activeTab === 'settings'}
          label="Settings"
        />
      </div>

      {/* Content */}
      {
        activeTab === 'overview' && (
          <div style={{
            maxWidth: '1200px',
            color: 'var(--text-secondary)',
            lineHeight: '1.6',
            fontSize: '16px',
            background: 'rgba(255,255,255,0.02)',
            padding: '40px',
            borderRadius: '24px',
            border: '1px solid var(--border-color)',
          }}>
            <h2 style={{ color: 'white', marginBottom: '16px', fontSize: '24px' }}>Analytics Engine</h2>
            <p>
              Here will be the Stats/Analysis (Not implemented yet). Everytime this template is used/posted,
              we will save the post ID and when the user come here (Overview tab), and clic on sync stats,
              we will execute an Apify actor to get the actual stats of each post, and sum them to display
              here, so we can see how much was the total reach, average,... to take decisions.
            </p>
          </div>
        )
      }

      {activeTab === 'assets' && <TemplateAssets templateId={id} />}

      {activeTab === 'settings' && <TemplateSettings template={template} accounts={accounts} />}

      {activeTab === 'builder' && (
        <AIBuilderTab
          template={template}
          initialAssets={await prisma.asset.findMany({
            where: {
              AND: [
                {
                  OR: [
                    { templateId: template.id },
                    ...(template.useAccountAssets && template.accountId ? [{ accountId: template.accountId }] : [])
                  ]
                },
                {
                  NOT: {
                    OR: [
                      { r2Key: { contains: '/outputs/' } },
                      { r2Key: { contains: '/Outputs/' } },
                      { url: { contains: '/outputs/' } },
                      { url: { contains: '/Outputs/' } }
                    ]
                  }
                }
              ]
            }
          })}
        />
      )}
    </div >
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
    where: {
      AND: [
        {
          OR: [
            { templateId },
            ...(template?.useAccountAssets && template?.accountId ? [{ accountId: template.accountId }] : [])
          ]
        },
        {
          NOT: {
            OR: [
              { r2Key: { contains: '/outputs/' } },
              { r2Key: { contains: '/Outputs/' } },
              { url: { contains: '/outputs/' } },
              { url: { contains: '/Outputs/' } }
            ]
          }
        }
      ]
    },
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

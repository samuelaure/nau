import { prisma } from '@/modules/shared/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Instagram } from 'lucide-react'
import AssetsManager from '@/modules/shared/components/AssetsManager'
import AddTemplateButton from '@/modules/video/components/AddTemplateButton'
import AccountSettings from '@/modules/accounts/components/AccountSettings'
import AccountPersonas from '@/modules/accounts/components/AccountPersonas'
import AccountIdeas from '@/modules/accounts/components/AccountIdeas'
import AccountDrafts from '@/modules/accounts/components/AccountDrafts'
import TemplateCard from '@/modules/video/components/TemplateCard'
import ExternalAccountLink from '@/modules/accounts/components/ExternalAccountLink'
import { cn } from '@/modules/shared/utils'
import type { TemplateWithRelations } from '@/types'

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

  if (!account) {
    throw new Error("Account not found for id: '" + id + "'")
  }

  return (
    <div className="animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-text-secondary mb-6 text-sm">
        <Link href="/dashboard/accounts" className="hover:text-white transition-colors">
          Accounts
        </Link>
        <ChevronRight size={16} />
        <span className="text-white">{account.username}</span>
      </div>

      {/* Header */}
      <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="flex gap-6 items-center">
          <div className="w-20 h-20 rounded-full p-[3px] bg-[linear-gradient(45deg,#f09433_0%,#e6683c_25%,#dc2743_50%,#cc2366_75%,#bc1888_100%)] overflow-hidden shrink-0">
            <div className="w-full h-full rounded-full bg-panel flex items-center justify-center overflow-hidden">
              {account.profileImage ? (
                <img
                  src={account.profileImage}
                  alt={account.username || 'Profile'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Instagram size={40} />
              )}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-heading font-semibold">{account.username}</h1>
              <ExternalAccountLink username={account.username} />
            </div>
            <p className="text-text-secondary">Instagram Business Account • {account.platformId}</p>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-border mb-8 overflow-x-auto">
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
          href={`/dashboard/accounts/${id}?tab=personas`}
          active={activeTab === 'personas'}
          label="Brand Personas"
        />
        <TabLink
          href={`/dashboard/accounts/${id}?tab=ideas`}
          active={activeTab === 'ideas'}
          label="Ideas Backlog"
        />
        <TabLink
          href={`/dashboard/accounts/${id}?tab=drafts`}
          active={activeTab === 'drafts'}
          label="Drafts"
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
      {activeTab === 'personas' && <AccountPersonas accountId={id} />}
      {activeTab === 'ideas' && <AccountIdeas accountId={id} />}
      {activeTab === 'drafts' && <AccountDrafts accountId={id} />}
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
      className={cn(
        'px-6 py-3 -mb-px flex items-center gap-2 border-b-2 transition-colors',
        active
          ? 'text-white border-accent font-semibold'
          : 'text-text-secondary border-transparent hover:text-white',
      )}
    >
      {label}
      {count !== undefined && (
        <span
          className={cn('px-2 py-0.5 rounded-xl text-xs', active ? 'bg-white/10' : 'bg-white/5')}
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
    include: {
      _count: { select: { renders: true } },
      account: { select: { username: true, platform: true } },
    },
  })

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-heading font-semibold">Attached Templates</h3>
        <AddTemplateButton
          label="Create Template"
          accounts={[{ id: accountId, username: 'Current Account', platform: 'Instagram' }]}
          defaultAccountId={accountId}
        />
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-6">
        {templates.map((template: TemplateWithRelations) => (
          <TemplateCard key={template.id} template={template} context="account" />
        ))}
      </div>
      {templates.length === 0 && (
        <div className="text-center py-10 text-text-secondary">
          No templates attached to this account.
        </div>
      )}
    </div>
  )
}

async function AccountAssets({ accountId }: { accountId: string }) {
  const account = await prisma.socialAccount.findUnique({
    where: { id: accountId },
    select: { username: true, id: true, assetsRoot: true },
  })

  const assets = await prisma.asset.findMany({
    where: { accountId },
    orderBy: { createdAt: 'desc' },
  })

  const basePath = account?.assetsRoot || account?.username || account?.id || ''

  return (
    <AssetsManager ownerId={accountId} ownerType="account" assets={assets} basePath={basePath} />
  )
}

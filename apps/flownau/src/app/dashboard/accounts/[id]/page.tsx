export const dynamic = 'force-dynamic'

import { prisma } from '@/modules/shared/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Instagram, AlertTriangle, CheckCircle2 } from 'lucide-react'
import AssetsManager from '@/modules/shared/components/AssetsManager'
import AddTemplateButton from '@/modules/video/components/AddTemplateButton'
import AccountSettings from '@/modules/accounts/components/AccountSettings'
import AccountPersonas from '@/modules/accounts/components/AccountPersonas'
import AccountIdeas from '@/modules/accounts/components/AccountIdeas'
import TemplateCard from '@/modules/video/components/TemplateCard'
import ExternalAccountLink from '@/modules/accounts/components/ExternalAccountLink'
import { cn } from '@/modules/shared/utils'
import { approveComposition } from '@/modules/compositions/actions'
import { Button } from '@/modules/shared/components/ui/Button'
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
    notFound()
  }

  const tokenDaysLeft = account.tokenExpiresAt
    ? // eslint-disable-next-line react-hooks/purity
      Math.ceil((new Date(account.tokenExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

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
              {/* Token Health Pill */}
              {tokenDaysLeft !== null ? (
                tokenDaysLeft <= 7 ? (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 text-xs font-semibold">
                    <AlertTriangle size={11} /> Token expiring in {tokenDaysLeft}d
                  </span>
                ) : tokenDaysLeft <= 14 ? (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-xs font-semibold">
                    <AlertTriangle size={11} /> Token expiring soon
                  </span>
                ) : (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-semibold">
                    <CheckCircle2 size={11} /> Token healthy
                  </span>
                )
              ) : null}
            </div>
            <p className="text-text-secondary">
              Instagram Business Account &bull; {account.platformId}
            </p>
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
          href={`/dashboard/accounts/${id}?tab=compositions`}
          active={activeTab === 'compositions'}
          label="Compositions"
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
      {activeTab === 'compositions' && <AccountCompositions accountId={id} />}
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

async function AccountCompositions({ accountId }: { accountId: string }) {
  const compositions = await prisma.composition.findMany({
    where: { accountId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { renderJob: true },
  })

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-heading font-semibold">Compositions</h3>
        <Link
          href={`/dashboard/compositions?accountId=${accountId}`}
          className="text-sm text-accent hover:text-accent-hover font-semibold"
        >
          View All →
        </Link>
      </div>
      <div className="glass overflow-hidden">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-white/5 text-text-secondary text-sm">
              <th className="p-4 pl-6 font-heading">Format</th>
              <th className="p-4 font-heading">Status</th>
              <th className="p-4 font-heading">Render</th>
              <th className="p-4 font-heading">Created</th>
              <th className="p-4 pr-6 font-heading">Action</th>
            </tr>
          </thead>
          <tbody>
            {compositions.map((comp) => (
              <tr
                key={comp.id}
                className="border-b border-white/5 text-sm hover:bg-white/5 transition-colors"
              >
                <td className="p-4 pl-6">
                  <span className="px-2 py-0.5 rounded text-xs bg-white/5 text-text-secondary">
                    {FORMAT_LABELS[comp.format] ?? comp.format}
                  </span>
                </td>
                <td className="p-4">
                  <span
                    className={`px-2.5 py-1 rounded-md text-xs font-bold ${STATUS_STYLES[comp.status] ?? 'bg-white/5 text-text-secondary'}`}
                  >
                    {comp.status}
                  </span>
                </td>
                <td className="p-4 text-text-secondary text-xs">{comp.renderJob?.status ?? '—'}</td>
                <td className="p-4 text-text-secondary text-xs">
                  {new Date(comp.createdAt).toLocaleDateString()}
                </td>
                <td className="p-4 pr-6 flex items-center gap-2">
                  {comp.status === 'draft' && (
                    <form action={approveComposition.bind(null, comp.id)}>
                      <Button
                        type="submit"
                        size="sm"
                        className="bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 text-xs h-7 px-2"
                      >
                        Approve
                      </Button>
                    </form>
                  )}
                  <Link href={`/dashboard/compositions/${comp.id}`}>
                    <Button variant="ghost" size="sm" className="text-accent text-xs h-7 px-2">
                      View
                    </Button>
                  </Link>
                </td>
              </tr>
            ))}
            {compositions.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-text-secondary italic text-sm">
                  No compositions yet for this account.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

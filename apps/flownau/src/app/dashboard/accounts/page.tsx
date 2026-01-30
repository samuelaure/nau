import { prisma } from '@/lib/prisma'
import { Instagram } from 'lucide-react'
import AddAccountButton from './AddAccountButton'
import { deleteAccount } from './actions'
import ActionMenu from '@/components/ActionMenu'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'

export default async function AccountsPage() {
  const accounts = await prisma.socialAccount.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { templates: true } } },
  })

  return (
    <div className="animate-fade-in">
      <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-heading font-semibold mb-2">Instagram Accounts</h1>
          <p className="text-text-secondary">
            Manage multiple Instagram profiles and their connections.
          </p>
        </div>
        <AddAccountButton
          existingAccounts={accounts.map(a => ({
            id: a.id,
            username: a.username,
            accessToken: a.accessToken
          }))}
        />
      </header>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-6">
        {accounts.map((account: any) => (
          <Card key={account.id} className="relative group hover:border-accent/40 transition-colors">
            {/* Overlay Link for whole-card clickability */}
            <Link
              href={`/dashboard/accounts/${account.id}`}
              className="absolute inset-0 z-[1]"
            />

            <ActionMenu
              onDelete={deleteAccount.bind(null, account.id)}
            />

            <div className="relative z-[2] pointer-events-none">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-[60px] h-[60px] rounded-full p-[2px] bg-[linear-gradient(45deg,#f09433_0%,#e6683c_25%,#dc2743_50%,#cc2366_75%,#bc1888_100%)] overflow-hidden shrink-0">
                  <div className="w-full h-full rounded-full bg-panel flex items-center justify-center overflow-hidden">
                    {account.profileImage ? (
                      <img
                        src={account.profileImage}
                        alt={account.username || 'Profile'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Instagram size={28} />
                    )}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">{account.username || 'Syncing...'}</h3>
                  </div>
                  <p className="text-xs text-text-secondary">
                    Added on {new Date(account.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-1 p-3 bg-white/5 rounded-lg text-center">
                  <p className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">
                    Status
                  </p>
                  <p className="text-sm font-semibold text-success">
                    Connected
                  </p>
                </div>
                <div className="flex-1 p-3 bg-white/5 rounded-lg text-center">
                  <p className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">
                    Templates
                  </p>
                  <p className="text-sm font-semibold">
                    {account._count?.templates || 0}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        ))}

        {accounts.length === 0 && (
          <Card className="col-span-full py-20 px-10 text-center border-dashed bg-transparent flex flex-col items-center">
            <Instagram
              size={48}
              className="text-text-secondary mb-4 opacity-50"
            />
            <h3 className="text-xl font-semibold mb-2">No accounts linked</h3>
            <p className="text-text-secondary mb-6">
              Connect your first Instagram Business account to start publishing.
            </p>
            <AddAccountButton />
          </Card>
        )}
      </div>
    </div>
  )
}

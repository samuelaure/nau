import { prisma } from '@/lib/prisma'
import { Instagram } from 'lucide-react'
import AddAccountButton from './AddAccountButton'
import { deleteAccount } from './actions'
import ActionMenu from '@/components/ActionMenu'
import Link from 'next/link'
import { syncAccountProfile } from './actions'

export default async function AccountsPage() {
  const accounts = await prisma.socialAccount.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { templates: true } } },
  })

  return (
    <div className="animate-fade-in">
      <header
        style={{
          marginBottom: '40px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}
      >
        <div>
          <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>Instagram Accounts</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '24px',
        }}
      >
        {accounts.map((account: any) => (
          <div key={account.id} className="card" style={{ position: 'relative' }}>
            {/* Overlay Link for whole-card clickability */}
            <Link
              href={`/dashboard/accounts/${account.id}`}
              style={{ position: 'absolute', inset: 0, zIndex: 1 }}
            />

            <ActionMenu
              onDelete={deleteAccount.bind(null, account.id)}
            // Audit: ActionMenu usually has z-index high enough (10 in component)
            />

            <div
              style={{ cursor: 'pointer', position: 'relative', zIndex: 2, pointerEvents: 'none' }}
            >
              {/* Content must pass through clicks unless interactive. 
                                Using pointer-events: none on container, and pointer-events: auto on text if we want selection?
                                Or just rely on Overlay Link z-1 covering content z-0?
                                If we put content as z-0, the overlay z-1 covers it, so clicks go to Link. Good.
                                But 'ActionMenu' needs to be clickable (it is aboslute, z-10).
                                'ExternalAccountLink' needs to be clickable.
                            */}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  marginBottom: '20px',
                  // We want text to be selectable? If covered by link, it isn't easily.
                  // But that's the trade-off for "Card Link".
                  // To make text selectable, text must be z-2 and relative, but then it blocks the link click.
                  // For now, simple Overlay Link strategy.
                }}
              >
                <div
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background:
                      'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                    padding: '2px',
                    overflow: 'hidden',
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
                      overflow: 'hidden',
                    }}
                  >
                    {account.profileImage ? (
                      <img
                        src={account.profileImage}
                        alt={account.username || 'Profile'}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <Instagram size={28} />
                    )}
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '18px' }}>{account.username || 'Syncing...'}</h3>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Added on {new Date(account.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '8px',
                    textAlign: 'center',
                  }}
                >
                  <p
                    style={{
                      fontSize: '10px',
                      color: 'var(--text-secondary)',
                      textTransform: 'uppercase',
                    }}
                  >
                    Status
                  </p>
                  <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--success)' }}>
                    Connected
                  </p>
                </div>
                <div
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '8px',
                    textAlign: 'center',
                  }}
                >
                  <p
                    style={{
                      fontSize: '10px',
                      color: 'var(--text-secondary)',
                      textTransform: 'uppercase',
                    }}
                  >
                    Templates
                  </p>
                  <p style={{ fontSize: '14px', fontWeight: '600' }}>
                    {account._count?.templates || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}

        {accounts.length === 0 && (
          <div
            className="card"
            style={{
              gridColumn: '1 / -1',
              textAlign: 'center',
              padding: '80px 40px',
              borderStyle: 'dashed',
              background: 'transparent',
            }}
          >
            <Instagram
              size={48}
              style={{ color: 'var(--text-secondary)', marginBottom: '16px', opacity: 0.5 }}
            />
            <h3 style={{ marginBottom: '8px' }}>No accounts linked</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Connect your first Instagram Business account to start publishing.
            </p>
            <AddAccountButton />
          </div>
        )}
      </div>
    </div>
  )
}

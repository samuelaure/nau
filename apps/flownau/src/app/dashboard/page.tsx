import { prisma } from '@/lib/prisma'
import { Instagram, Video, CheckCircle, Clock } from 'lucide-react'

export default async function DashboardPage() {
  const accountsCount = await prisma.socialAccount.count()
  const templatesCount = await prisma.template.count()
  const recentRenders = await prisma.render.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: { template: true },
  })

  const stats = [
    { name: 'Active Accounts', value: accountsCount, icon: Instagram, color: '#E1306C' },
    { name: 'Total Templates', value: templatesCount, icon: Video, color: '#7C3AED' },
    { name: 'Success Rate', value: '98.2%', icon: CheckCircle, color: '#10B981' },
    { name: 'Est. Render Time', value: '42s', icon: Clock, color: '#F59E0B' },
  ]

  return (
    <div className="animate-fade-in">
      <header style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>Dashboard Overview</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Monitor your automated video workflows.</p>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '24px',
          marginBottom: '48px',
        }}
      >
        {stats.map((stat) => (
          <div
            key={stat.name}
            className="card"
            style={{ display: 'flex', alignItems: 'center', gap: '20px' }}
          >
            <div
              style={{
                padding: '12px',
                background: `${stat.color}15`,
                borderRadius: '12px',
                color: stat.color,
              }}
            >
              <stat.icon size={28} />
            </div>
            <div>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{stat.name}</p>
              <h3 style={{ fontSize: '24px' }}>{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      <div>
        <h2 style={{ fontSize: '24px', marginBottom: '24px' }}>Recent Activty</h2>
        <div className="glass" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)',
                  fontSize: '14px',
                }}
              >
                <th style={{ padding: '16px 24px' }}>Template</th>
                <th style={{ padding: '16px 24px' }}>Status</th>
                <th style={{ padding: '16px 24px' }}>Date</th>
                <th style={{ padding: '16px 24px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {recentRenders.map((render: any) => (
                <tr
                  key={render.id}
                  style={{ borderBottom: '1px solid var(--border-color)', fontSize: '14px' }}
                >
                  <td style={{ padding: '16px 24px' }}>{render.template.name}</td>
                  <td style={{ padding: '16px 24px' }}>
                    <span
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        background: render.status === 'COMPLETED' ? '#10B98120' : '#F59E0B20',
                        color: render.status === 'COMPLETED' ? '#10B981' : '#F59E0B',
                        fontSize: '12px',
                        fontWeight: '600',
                      }}
                    >
                      {render.status}
                    </span>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    {new Date(render.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <button
                      style={{
                        color: 'var(--accent-color)',
                        background: 'none',
                        border: 'none',
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {recentRenders.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}
                  >
                    No recent activity found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

import { prisma } from '@/lib/prisma'
import { Play, ExternalLink, Table, Video, CheckCircle as CheckCircleIcon } from 'lucide-react'
import AddTemplateButton from './AddTemplateButton'
import TemplateCard from '@/components/TemplateCard'
import { deleteTemplate } from './actions'

export default async function TemplatesPage() {
  const [templates, accounts] = await Promise.all([
    prisma.template.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { renders: true } },
        account: { select: { username: true, platform: true } },
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

  // Group templates by account
  const groupedTemplates: Record<string, typeof templates> = {}
  const unassignedTemplates: typeof templates = []

  templates.forEach((t) => {
    if (t.accountId && t.account) {
      const key = t.account.username || 'Unknown Account'
      if (!groupedTemplates[key]) {
        groupedTemplates[key] = []
      }
      groupedTemplates[key].push(t)
    } else {
      unassignedTemplates.push(t)
    }
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
          <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>Video Templates</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Automated video schemas linked to Airtable tables.
          </p>
        </div>
        <AddTemplateButton label="New Template" accounts={accounts} />
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
        {Object.entries(groupedTemplates).map(([accountName, accountTemplates]) => (
          <div key={accountName}>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background:
                    'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                }}
              >
                <Video size={16} />
              </div>
              <h2 style={{ fontSize: '20px' }}>{accountName}</h2>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                gap: '24px',
              }}
            >
              {accountTemplates.map((template) => (
                <TemplateCard key={template.id} template={template} context="templates" />
              ))}
            </div>
          </div>
        ))}

        {unassignedTemplates.length > 0 && (
          <div>
            {Object.keys(groupedTemplates).length > 0 && (
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}
              >
                <GlobeIcon />
                <h2 style={{ fontSize: '20px' }}>Global Templates</h2>
              </div>
            )}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                gap: '24px',
              }}
            >
              {unassignedTemplates.map((template) => (
                <TemplateCard key={template.id} template={template} context="templates" />
              ))}
            </div>
          </div>
        )}

        {templates.length === 0 && (
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
            <Video
              size={48}
              style={{ color: 'var(--text-secondary)', marginBottom: '16px', opacity: 0.5 }}
            />
            <h3 style={{ marginBottom: '8px' }}>No templates created</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Create your first video template and link it to an Airtable table.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <AddTemplateButton label="Create Template" accounts={accounts} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function GlobeIcon() {
  return (
    <div
      style={{
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        background: '#27272a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-secondary)',
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="2" y1="12" x2="22" y2="12"></line>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
      </svg>
    </div>
  )
}

function CheckCircle({ size, style }: { size?: number; style?: any }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size || 24}
      height={size || 24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
  )
}

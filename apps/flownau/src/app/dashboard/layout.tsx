import Sidebar from '@/modules/shared/components/Sidebar'
import { bootstrapSystem } from '@/modules/shared/bootstrap'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Run on every dashboard request at runtime (never at build time due to force-dynamic)
  await bootstrapSystem()
  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main
        style={{
          marginLeft: '320px',
          padding: '40px',
          width: '100%',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        <div className="glass px-6 py-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-4 text-text-secondary text-sm">
            <div className="font-semibold text-white">Personal Workspace</div>
            <span>/</span>
            <div>All Brands</div>
          </div>
          <div>{/* Future actions */}</div>
        </div>
        {children}
      </main>
    </div>
  )
}

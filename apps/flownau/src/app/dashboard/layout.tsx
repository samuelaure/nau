import Sidebar from '@/modules/shared/components/Sidebar'
import { bootstrapSystem } from '@/modules/shared/bootstrap'
import { BrandSwitcher } from '@/modules/shared/components/BrandSwitcher'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
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
          <BrandSwitcher />
          <div>{/* Future actions */}</div>
        </div>
        {children}
      </main>
    </div>
  )
}

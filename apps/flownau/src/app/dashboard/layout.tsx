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
        }}
      >
        {children}
      </main>
    </div>
  )
}

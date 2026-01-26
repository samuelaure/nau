import Sidebar from '@/components/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
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

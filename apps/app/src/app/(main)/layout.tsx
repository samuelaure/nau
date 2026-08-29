import { AppShell } from '@/core/shell/app-shell'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}

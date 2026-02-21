import type { Metadata } from 'next'
import { Toaster } from 'sonner'
import { bootstrapSystem } from '@/modules/shared/bootstrap'
import './globals.css'

export const metadata: Metadata = {
  title: 'flownaŭ | Video Automation',
  description: 'Automate your Instagram presence with data-driven videos',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Ensure basic system state (like admin user) exists
  await bootstrapSystem()
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster theme="dark" position="bottom-right" richColors />
      </body>
    </html>
  )
}

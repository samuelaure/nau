import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'flownaŭ | Video Automation',
  description: 'Automate your Instagram presence with data-driven videos',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

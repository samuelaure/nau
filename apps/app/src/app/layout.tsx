import type { Metadata, Viewport } from 'next'
import { Inter as FontSans } from 'next/font/google'
import { cn } from '@9nau/ui/lib/utils'
import { AppProvider } from '@/providers/app-provider'
import './globals.css'
import React from 'react'

const fontSans = FontSans({
  subsets: ['latin'],
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: '9naŭ',
  description: 'Life & business growth',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#030712' } // gray-950
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

/**
 * Applies the `dark` class before the first paint, synchronously — not in a
 * React effect, which would only run after hydration and produce exactly
 * the white flash this exists to avoid (confirmed as the actual complaint:
 * refreshing at night briefly shows light before shell-store.ts's
 * hydrateFromStorage runs). Inline and blocking is the standard fix for
 * this class of problem precisely because nothing else runs early enough.
 *
 * Dark is the default (`nau:theme` unset or absent) — light is the opt-out
 * now, not the other way around. `suppressHydrationWarning` on `<html>`
 * above tells React this element's attributes are deliberately allowed to
 * differ between server and client markup, which they always will here:
 * the server never knows the visitor's stored preference.
 */
const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem('nau:theme');
    if (stored !== 'light') document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={cn('bg-background font-sans antialiased', fontSans.variable)}>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  )
}

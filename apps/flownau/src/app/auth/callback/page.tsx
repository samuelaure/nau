'use client'

export const dynamic = 'force-dynamic'

import { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

function CallbackHandler() {
  const searchParams = useSearchParams()

  useEffect(() => {
    const token = searchParams.get('token')
    const isProduction = window.location.hostname.endsWith('.9nau.com')
    const domainPart = isProduction ? '; domain=.9nau.com' : ''
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString()

    if (token) {
      // Flow A: accounts.9nau.com appended ?token= to continueUrl
      document.cookie = `nau_token=${token}; expires=${expires}; path=/${domainPart}; SameSite=Lax`
      window.location.href = '/dashboard'
      return
    }

    // Flow B: accounts.9nau.com set cookie on .9nau.com domain and redirected
    // here without a token param — check if the cookie is already present.
    const existingToken = document.cookie
      .split('; ')
      .find((row) => row.startsWith('nau_token='))
      ?.split('=')[1]

    if (existingToken) {
      window.location.href = '/dashboard'
      return
    }

    // No token anywhere — send back to home
    window.location.href = '/'
  }, [searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top_right,#1e1b4b,#000)]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 size={40} className="animate-spin text-accent" />
        <p className="text-text-secondary text-sm">Signing you in…</p>
      </div>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <CallbackHandler />
    </Suspense>
  )
}

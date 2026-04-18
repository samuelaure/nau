'use client'

export const dynamic = 'force-dynamic'

import { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

function CallbackHandler() {
  const searchParams = useSearchParams()

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      window.location.href = '/'
      return
    }

    // Set the nau_token cookie (30-day expiry)
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString()
    document.cookie = `nau_token=${token}; expires=${expires}; path=/; SameSite=Lax`

    window.location.href = '/dashboard'
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

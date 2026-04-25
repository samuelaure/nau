'use client'

export const dynamic = 'force-dynamic'

import { useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Loader2 } from 'lucide-react'

function CallbackHandler() {
  const router = useRouter()

  useEffect(() => {
    fetch('/api/auth/nau-token')
      .then((r) => r.json())
      .then(async ({ token }: { token: string | null }) => {
        if (!token) {
          router.replace('/login')
          return
        }
        const result = await signIn('nau-sso', { token, redirect: false })
        if (result?.ok) {
          router.replace('/')
          router.refresh()
        } else {
          router.replace('/login')
        }
      })
      .catch(() => router.replace('/login'))
  }, [router])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
      <Loader2 className="animate-spin" size={40} color="var(--primary)" />
      <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Iniciando sesión con naŭ…</p>
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

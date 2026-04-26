'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { loginAction } from '../actions'

const DEFAULT_REDIRECT = '/choose'

function LoginFormInner() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const searchParams = useSearchParams()
  const redirectUri =
    searchParams.get('redirect_uri') ?? searchParams.get('continue') ?? DEFAULT_REDIRECT

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await loginAction(email, password)
      if (!result.ok) {
        setError(result.message)
        return
      }
      window.location.href = redirectUri
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const registerHref = `/register?redirect_uri=${encodeURIComponent(redirectUri)}`

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top_right,#1e1b4b,#000)] p-4">
      <div className="glass w-full max-w-md animate-fade-in p-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-[0_0_24px_rgba(124,58,237,0.5)]">
            <span className="text-white text-2xl font-bold font-heading">9</span>
          </div>
          <h1 className="text-3xl font-heading font-bold mb-2">Sign in to 9naŭ</h1>
          <p className="text-white/60 text-sm">
            {redirectUri !== DEFAULT_REDIRECT ? 'Sign in to continue to your app.' : 'Welcome back.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-white/80">Email Address</label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input-field"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-white/80">Password</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input-field"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button type="submit" className="btn-primary w-full justify-center h-12 mt-1" disabled={loading}>
            {loading ? <Loader2 size={18} className="animate-spin" /> : 'Sign In'}
          </button>

          <p className="text-center text-white/50 text-sm mt-2">
            Don&apos;t have an account?{' '}
            <Link href={registerHref} className="text-violet-400 hover:underline">
              Create one
            </Link>
          </p>
        </form>
      </div>

      <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-violet-600/10 blur-[150px] -z-10 rounded-full pointer-events-none" />
    </div>
  )
}

export function LoginForm() {
  return (
    <Suspense>
      <LoginFormInner />
    </Suspense>
  )
}

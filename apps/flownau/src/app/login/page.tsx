'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Rocket } from 'lucide-react'
import { Input } from '@/modules/shared/components/ui/Input'
import { Button } from '@/modules/shared/components/ui/Button'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError((body as { message?: string }).message ?? 'Invalid credentials')
      } else {
        router.push('/dashboard')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top_right,#1e1b4b,#000)] p-4">
      <div className="glass w-full max-w-md animate-fade-in p-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(124,58,237,0.5)]">
            <Rocket size={32} color="white" />
          </div>
          <h1 className="text-3xl font-heading font-bold mb-2 lowercase">flownaŭ</h1>
          <p className="text-text-secondary">Welcome back.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Input
            label="Email Address"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full"
          />
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full"
          />

          {error && <p className="text-error text-sm">{error}</p>}

          <Button type="submit" className="w-full h-12 justify-center mt-3" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </Button>

          <p className="text-center text-text-secondary text-sm mt-4">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-accent hover:underline">Register</Link>
          </p>
        </form>
      </div>
    </div>
  )
}

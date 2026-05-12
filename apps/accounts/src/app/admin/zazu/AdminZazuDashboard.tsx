'use client'

import { useState } from 'react'

type SendResult = { ok: true; sent: number } | { ok: false; error: string }

export function AdminZazuDashboard() {
  return (
    <div className="min-h-screen p-8 max-w-2xl mx-auto space-y-10">
      <h1 className="text-2xl font-heading font-semibold">Zazŭ Admin</h1>
      <DirectMessageForm />
      <BroadcastForm />
    </div>
  )
}

function DirectMessageForm() {
  const [telegramId, setTelegramId] = useState('')
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<SendResult | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setResult(null)
    const res = await fetch('/api/admin/zazu/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramId, message }),
    })
    setResult(await res.json() as SendResult)
    setLoading(false)
    if (res.ok) setMessage('')
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-medium">Direct Message</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Telegram ID</label>
          <input
            type="text"
            value={telegramId}
            onChange={(e) => setTelegramId(e.target.value)}
            placeholder="e.g. 123456789"
            required
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            required
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50"
        >
          {loading ? 'Sending…' : 'Send'}
        </button>
        {result && (
          <p className={`text-sm ${result.ok ? 'text-green-600' : 'text-red-500'}`}>
            {result.ok ? '✅ Sent' : `❌ ${result.error}`}
          </p>
        )}
      </form>
    </section>
  )
}

function BroadcastForm() {
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<SendResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!confirmed) { setConfirmed(true); return }
    setLoading(true)
    setResult(null)
    const res = await fetch('/api/admin/zazu/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    })
    setResult(await res.json() as SendResult)
    setLoading(false)
    setConfirmed(false)
    if (res.ok) setMessage('')
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-medium">Broadcast to All Users</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Message</label>
          <textarea
            value={message}
            onChange={(e) => { setMessage(e.target.value); setConfirmed(false) }}
            rows={4}
            required
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className={`px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 ${confirmed ? 'bg-red-600 text-white' : 'bg-primary text-primary-foreground'}`}
        >
          {loading ? 'Sending…' : confirmed ? 'Confirm broadcast?' : 'Broadcast'}
        </button>
        {result && (
          <p className={`text-sm ${result.ok ? 'text-green-600' : 'text-red-500'}`}>
            {result.ok ? `✅ Sent to ${result.sent} user(s)` : `❌ ${result.error}`}
          </p>
        )}
      </form>
    </section>
  )
}

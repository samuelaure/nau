'use client'

import { useState } from 'react'
import { Card } from '@/modules/shared/components/ui/Card'
import { generateTelegramLinkToken } from './actions'

export default function TelegramLinkCard({ linked }: { linked: boolean }) {
  const [deepLink, setDeepLink] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (linked) {
    return (
      <Card className="p-8">
        <div className="flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <div>
            <h3 className="text-lg font-heading font-semibold">Telegram Connected</h3>
            <p className="text-sm text-text-secondary mt-1">Your naŭ account is linked. You'll receive approval notifications via Zazŭ bot.</p>
          </div>
        </div>
      </Card>
    )
  }

  async function handleLink() {
    setLoading(true)
    setError(null)
    const result = await generateTelegramLinkToken()
    if (result.error) {
      setError(result.error)
    } else {
      setDeepLink(result.deepLink!)
    }
    setLoading(false)
  }

  return (
    <Card className="p-8">
      <div className="flex items-start gap-3">
        <span className="text-2xl">💬</span>
        <div className="flex-1">
          <h3 className="text-lg font-heading font-semibold">Connect Telegram</h3>
          <p className="text-sm text-text-secondary mt-1 mb-4">
            Link your Telegram account to receive approval notifications and send voice note ideas via Zazŭ bot.
          </p>
          {deepLink ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-text-secondary">Open the link below in Telegram to complete the connection:</p>
              <a
                href={deepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#2AABEE] text-white rounded-lg font-medium text-sm w-fit hover:opacity-90 transition-opacity"
              >
                Open Zazŭ in Telegram →
              </a>
              <p className="text-xs text-text-secondary">Link expires in 15 minutes.</p>
            </div>
          ) : (
            <button
              onClick={handleLink}
              disabled={loading}
              className="px-4 py-2 bg-brand-primary text-white rounded-lg font-medium text-sm disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              {loading ? 'Generating link…' : 'Link Telegram Account'}
            </button>
          )}
          {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
        </div>
      </div>
    </Card>
  )
}

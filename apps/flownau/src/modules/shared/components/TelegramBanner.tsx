'use client'

import Link from 'next/link'

export default function TelegramBanner() {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3 bg-[#2AABEE]/10 border border-[#2AABEE]/30 rounded-xl text-sm">
      <div className="flex items-center gap-2">
        <span>💬</span>
        <span className="text-text-secondary">
          Connect Telegram to receive post approval alerts and send voice note ideas via Zazŭ.
        </span>
      </div>
      <Link
        href="/dashboard/settings"
        className="shrink-0 px-3 py-1.5 bg-[#2AABEE] text-white rounded-lg font-medium text-xs hover:opacity-90 transition-opacity"
      >
        Connect
      </Link>
    </div>
  )
}

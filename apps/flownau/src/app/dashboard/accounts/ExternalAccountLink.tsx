'use client'

import { ExternalLink } from 'lucide-react'

interface ExternalAccountLinkProps {
  username?: string | null
}

export default function ExternalAccountLink({ username }: ExternalAccountLinkProps) {
  if (!username) return null

  return (
    <a
      href={`https://www.instagram.com/${username.replace('@', '')}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}
      className="hover:text-white transition-colors"
    >
      <ExternalLink size={14} />
    </a>
  )
}

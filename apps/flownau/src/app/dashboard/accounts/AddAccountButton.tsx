'use client'

import { useState, useTransition } from 'react'
import { Plus, Instagram, Loader2, Copy } from 'lucide-react'
import { addAccount } from './actions'
import Modal from '@/components/Modal'

interface SimpleAccount {
  id: string
  username: string | null
  accessToken: string
}

interface AddAccountButtonProps {
  existingAccounts?: SimpleAccount[]
}

export default function AddAccountButton({ existingAccounts = [] }: AddAccountButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // State to manage the selected token source
  const [selectedTokenSource, setSelectedTokenSource] = useState<string>('')
  // State to manage the token input value, so we can control it
  const [tokenValue, setTokenValue] = useState('')

  const handleTokenSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    setSelectedTokenSource(value)
    if (value) {
      const account = existingAccounts.find(a => a.id === value)
      if (account) {
        setTokenValue(account.accessToken)
      }
    } else {
      setTokenValue('')
    }
  }

  const handleSubmit = async (formData: FormData) => {
    setError(null)
    startTransition(async () => {
      try {
        await addAccount(formData)
        setIsOpen(false)
        // Reset form state
        setTokenValue('')
        setSelectedTokenSource('')
      } catch (e) {
        setError('Failed to add account. Please check your inputs.')
      }
    })
  }

  // Filter accounts that actually have an access token
  const accountsWithTokens = existingAccounts.filter(a => a.accessToken && a.username)

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="btn-primary">
        <Plus size={20} />
        Add Account
      </button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#e1306c',
            }}
          >
            <Instagram size={32} />
          </div>
          <h2 style={{ fontSize: '24px', marginBottom: '8px' }}>Connect Instagram</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Enter your long-lived access token details manually.
          </p>
        </div>

        <form
          action={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
        >
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                color: 'var(--text-secondary)',
              }}
            >
              Instagram Username
            </label>
            <input
              name="username"
              type="text"
              className="input-field"
              placeholder="@username"
              style={{ width: '100%' }}
              required
            />
          </div>

          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                color: 'var(--text-secondary)',
              }}
            >
              User ID (Platform ID)
            </label>
            <input
              name="platformId"
              type="text"
              className="input-field"
              placeholder="1784140..."
              style={{ width: '100%' }}
              required
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label
                style={{
                  fontSize: '14px',
                  color: 'var(--text-secondary)',
                }}
              >
                Access Token
              </label>

              {accountsWithTokens.length > 0 && (
                <div style={{ position: 'relative' }}>
                  <select
                    value={selectedTokenSource}
                    onChange={handleTokenSourceChange}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="">Manual Entry</option>
                    {accountsWithTokens.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        Copy from {acc.username}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <input
              name="accessToken"
              type="password"
              className="input-field"
              placeholder="EAAB..."
              style={{ width: '100%' }}
              required
              value={tokenValue}
              onChange={(e) => setTokenValue(e.target.value)}
            />
            {selectedTokenSource && (
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                <Copy size={12} style={{ display: 'inline', marginRight: '4px' }} />
                Using token from selected account
              </p>
            )}
          </div>

          {error && (
            <div
              style={{
                padding: '12px',
                background: 'rgba(239, 68, 68, 0.1)',
                color: 'var(--error)',
                borderRadius: '8px',
                fontSize: '14px',
                textAlign: 'center',
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary"
            disabled={isPending}
            style={{ justifyContent: 'center', marginTop: '12px' }}
          >
            {isPending ? <Loader2 className="animate-spin" size={20} /> : 'Connect Account'}
          </button>
        </form>
      </Modal>
    </>
  )
}

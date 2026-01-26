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
          <div className="form-group">
            <label className="form-label">
              Instagram Username
            </label>
            <input
              name="username"
              type="text"
              className="input-field"
              placeholder="@username"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              User ID (Platform ID)
            </label>
            <input
              name="platformId"
              type="text"
              className="input-field"
              placeholder="1784140..."
              required
            />
          </div>

          <div className="form-group" style={{ position: 'relative' }}>
            <label className="form-label">Access Token</label>
            <div style={{ position: 'relative' }}>
              <input
                name="accessToken"
                type="password"
                className="input-field"
                placeholder="EAAB..."
                required
                value={tokenValue}
                onChange={(e) => setTokenValue(e.target.value)}
                onFocus={() => accountsWithTokens.length > 0 && setSelectedTokenSource('open')}
                onBlur={() => setTimeout(() => setSelectedTokenSource(''), 200)}
                style={{
                  paddingRight: accountsWithTokens.length > 0 ? '40px' : '18px'
                }}
              />
              {accountsWithTokens.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    right: '16px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    opacity: 0.5
                  }}
                >
                  <Plus size={16} />
                </div>
              )}

              {selectedTokenSource === 'open' && accountsWithTokens.length > 0 && (
                <div
                  className="glass"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    left: 0,
                    right: 0,
                    zIndex: 20,
                    padding: '8px',
                    background: '#1a1a1c',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                    border: '1px solid var(--border-color)',
                    maxHeight: '200px',
                    overflowY: 'auto'
                  }}
                >
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', padding: '8px', borderBottom: '1px solid var(--border-color)', marginBottom: '4px' }}>
                    Copy from existing account:
                  </p>
                  {accountsWithTokens.map((acc) => (
                    <div
                      key={acc.id}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        setTokenValue(acc.accessToken)
                        setSelectedTokenSource('')
                      }}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        transition: 'background 0.2s'
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                      onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(225, 48, 108, 0.2)', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', color: '#e1306c' }}>
                        <Instagram size={14} />
                      </div>
                      <span style={{ fontWeight: '500' }}>{acc.username}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
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

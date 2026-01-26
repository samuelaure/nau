'use client'

import { useState, useTransition } from 'react'
import { Plus, Instagram, Loader2 } from 'lucide-react'
import { addAccount } from './actions'
import Modal from '@/components/Modal'

export default function AddAccountButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (formData: FormData) => {
    setError(null)
    startTransition(async () => {
      try {
        await addAccount(formData)
        setIsOpen(false)
      } catch (e) {
        setError('Failed to add account. Please check your inputs.')
      }
    })
  }

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
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                color: 'var(--text-secondary)',
              }}
            >
              Access Token
            </label>
            <input
              name="accessToken"
              type="password"
              className="input-field"
              placeholder="EAAB..."
              style={{ width: '100%' }}
              required
            />
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

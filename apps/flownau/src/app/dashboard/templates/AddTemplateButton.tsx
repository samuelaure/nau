'use client'

import { useState, useTransition } from 'react'
import { Plus, Video, Loader2 } from 'lucide-react'
import { addTemplate } from './actions'
import Modal from '@/components/Modal'

export default function AddTemplateButton({
  label = 'New Template',
  accounts = [],
  defaultAccountId,
}: {
  label?: string
  accounts?: any[]
  defaultAccountId?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (formData: FormData) => {
    setError(null)
    startTransition(async () => {
      try {
        await addTemplate(formData)
        setIsOpen(false)
      } catch (e) {
        setError('Failed to create template. Please check your inputs.')
      }
    })
  }

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="btn-primary">
        <Plus size={20} />
        {label}
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
              color: '#7c3aed',
            }}
          >
            <Video size={32} />
          </div>
          <h2 style={{ fontSize: '24px', marginBottom: '8px' }}>Create Template</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Define a new video schema for automation.
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
              Template Name
            </label>
            <input
              name="name"
              type="text"
              className="input-field"
              placeholder="e.g. Daily Update"
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
              Remotion Component ID
            </label>
            <input
              name="remotionId"
              type="text"
              className="input-field"
              placeholder="e.g. MyVideoComposition"
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
              Linked Account
            </label>
            <select
              name="accountId"
              className="input-field"
              style={{ width: '100%', cursor: 'pointer' }}
              defaultValue={defaultAccountId || ''}
            >
              <option value="">No Account (Global)</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.username} ({account.platform})
                </option>
              ))}
            </select>
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
              Airtable Table ID (Optional)
            </label>
            <input
              name="airtableTableId"
              type="text"
              className="input-field"
              placeholder="tbl..."
              style={{ width: '100%' }}
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
            {isPending ? <Loader2 className="animate-spin" size={20} /> : 'Create Template'}
          </button>
        </form>
      </Modal>
    </>
  )
}

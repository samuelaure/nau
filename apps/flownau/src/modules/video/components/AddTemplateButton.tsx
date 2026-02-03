'use client'

import { useState, useTransition } from 'react'
import { Plus, Video, Loader2 } from 'lucide-react'
import { addTemplate } from '@/modules/video/actions'
import Modal from '@/modules/shared/components/Modal'

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
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-accent/10 rounded-3xl flex items-center justify-center mx-auto mb-6 text-accent rotate-3 transition-transform hover:rotate-0 duration-300">
            <Video size={36} />
          </div>
          <h2 className="text-3xl font-heading font-bold mb-3 tracking-tight">Create Template</h2>
          <p className="text-text-secondary text-base max-w-[240px] mx-auto">
            Define a new video schema for your automated workflow.
          </p>
        </div>

        <form action={handleSubmit} className="flex flex-col gap-6">
          <div className="form-group">
            <label className="form-label">Template Name</label>
            <input
              name="name"
              type="text"
              className="input-field"
              placeholder="e.g. Daily Update"
              required
            />
          </div>

          <input type="hidden" name="remotionId" value="Universal" />

          <div className="form-group">
            <label className="form-label">Linked Account</label>
            <select name="accountId" className="input-field" defaultValue={defaultAccountId || ''}>
              <option value="">No Account (Global)</option>
              {accounts.map((account: any) => (
                <option key={account.id} value={account.id}>
                  {account.username} ({account.platform})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Airtable Table ID (Optional)</label>
            <input
              name="airtableTableId"
              type="text"
              className="input-field"
              placeholder="tbl..."
            />
          </div>

          {error && (
            <div className="p-4 bg-error/10 text-error border border-error/20 rounded-2xl text-sm text-center font-medium animate-shake">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary w-full mt-4 py-4 rounded-2xl text-lg group"
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="animate-spin" size={24} />
            ) : (
              <>
                Create Template
                <Plus
                  size={20}
                  className="group-hover:rotate-90 transition-transform duration-300"
                />
              </>
            )}
          </button>
        </form>
      </Modal>
    </>
  )
}

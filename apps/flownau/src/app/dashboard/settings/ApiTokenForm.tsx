'use client'

import { useState, useTransition } from 'react'
import { setSetting } from './actions'
import { Check, Loader2 } from 'lucide-react'

interface ApiTokenFormProps {
  settingKey: string
  label: string
  placeholder: string
  description?: string
  initialToken?: string
}

export default function ApiTokenForm({
  settingKey,
  label,
  placeholder,
  description,
  initialToken,
}: ApiTokenFormProps) {
  const [value, setValue] = useState(initialToken || '')
  const [isPending, startTransition] = useTransition()
  const [success, setSuccess] = useState(false)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSuccess(false)

    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      try {
        await setSetting(formData)
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      } catch (error) {
        console.error('Failed to save settings:', error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 mb-6">
      <input type="hidden" name="key" value={settingKey} />

      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
          {label}
        </label>
        <div className="flex gap-4">
          <input
            name="value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            type="password"
            className="input flex-1"
          />
          <button
            type="submit"
            disabled={isPending}
            className="btn-primary min-w-[100px] flex items-center justify-center gap-2"
          >
            {isPending ? (
              <Loader2 className="animate-spin h-4 w-4" />
            ) : success ? (
              <>
                <Check className="h-4 w-4" />
                Saved
              </>
            ) : (
              <>Save</>
            )}
          </button>
        </div>
        {description && <p className="mt-2 text-xs text-[var(--text-secondary)]">{description}</p>}
      </div>
    </form>
  )
}

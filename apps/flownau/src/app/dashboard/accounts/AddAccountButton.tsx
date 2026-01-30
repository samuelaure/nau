'use client'

import { useState, useTransition } from 'react'
import { Plus, Instagram, Loader2 } from 'lucide-react'
import { addAccount } from './actions'
import Modal from '@/components/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

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
      <Button onClick={() => setIsOpen(true)}>
        <Plus size={20} className="mr-2" />
        Add Account
      </Button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)}>
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-[#e1306c]">
            <Instagram size={32} />
          </div>
          <h2 className="text-2xl font-heading font-semibold mb-2">Connect Instagram</h2>
          <p className="text-text-secondary">
            Enter your long-lived access token details manually.
          </p>
        </div>

        <form
          action={handleSubmit}
          className="flex flex-col gap-5"
        >
          <Input
            name="username"
            label="Instagram Username"
            placeholder="@username"
            required
          />

          <Input
            name="platformId"
            label="User ID (Platform ID)"
            placeholder="1784140..."
            required
          />

          <div className="w-full relative">
            <label className="form-label">Access Token</label>
            <div className="relative">
              <input
                name="accessToken"
                type="password"
                className="input-field pr-10"
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
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                  <Plus size={16} />
                </div>
              )}

              {selectedTokenSource === 'open' && accountsWithTokens.length > 0 && (
                <div
                  className="absolute top-[calc(100%+8px)] left-0 right-0 z-20 p-2 bg-[#1a1a1c] border border-border shadow-2xl rounded-xl max-h-[200px] overflow-y-auto"
                >
                  <p className="text-xs text-text-secondary p-2 border-b border-border mb-1">
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
                      className="p-2.5 rounded-lg cursor-pointer text-sm flex items-center gap-2.5 hover:bg-white/5 transition-colors"
                    >
                      <div className="w-6 h-6 rounded-full bg-[#E1306C]/20 flex items-center justify-center text-[#e1306c]">
                        <Instagram size={14} />
                      </div>
                      <span className="font-medium">{acc.username}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="p-3 bg-error/10 text-error rounded-lg text-sm text-center">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={isPending}
            className="mt-3 w-full"
          >
            {isPending ? <Loader2 className="animate-spin mr-2" size={20} /> : null}
            {isPending ? 'Connecting...' : 'Connect Account'}
          </Button>
        </form>
      </Modal>
    </>
  )
}

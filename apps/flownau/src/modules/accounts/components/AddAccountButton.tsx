'use client'

import { useState, useTransition } from 'react'
import { Plus, Instagram, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { addAccount } from '@/modules/accounts/actions'
import Modal from '@/modules/shared/components/Modal'
import { Button } from '@/modules/shared/components/ui/Button'
import { Input } from '@/modules/shared/components/ui/Input'

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
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-[#E1306C]/10 rounded-3xl flex items-center justify-center mx-auto mb-6 text-[#E1306C] -rotate-3 transition-transform hover:rotate-0 duration-300">
            <Instagram size={36} />
          </div>
          <h2 className="text-3xl font-heading font-bold mb-3 tracking-tight">Connect Instagram</h2>
          <p className="text-text-secondary text-base max-w-[280px] mx-auto">
            Link your Instagram Business account using a long-lived access token.
          </p>
        </div>

        <form
          action={handleSubmit}
          className="flex flex-col gap-6"
        >
          <Input
            name="username"
            label="Instagram Username"
            placeholder="@username"
            required
            className="py-4"
          />

          <Input
            name="platformId"
            label="User ID (Platform ID)"
            placeholder="1784140..."
            required
            className="py-4"
          />

          <div className="w-full relative">
            <label className="form-label">Access Token</label>
            <div className="relative group">
              <input
                name="accessToken"
                type="password"
                className="input-field pr-12 py-4"
                placeholder="EAAB..."
                required
                value={tokenValue}
                onChange={(e) => setTokenValue(e.target.value)}
                onFocus={() => accountsWithTokens.length > 0 && setSelectedTokenSource('open')}
                onBlur={() => setTimeout(() => setSelectedTokenSource(''), 200)}
                style={{
                  paddingRight: accountsWithTokens.length > 0 ? '48px' : '18px'
                }}
              />
              {accountsWithTokens.length > 0 && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-accent transition-colors">
                  <Plus size={20} />
                </div>
              )}

              <AnimatePresence>
                {selectedTokenSource === 'open' && accountsWithTokens.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-[calc(100%+12px)] left-0 right-0 z-50 p-3 bg-panel border border-white/10 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.5)] rounded-2xl max-h-[240px] overflow-y-auto custom-scrollbar glass"
                  >
                    <p className="text-[11px] font-bold text-text-secondary px-3 py-2 uppercase tracking-widest border-b border-white/5 mb-2">
                      Quick Import
                    </p>
                    {accountsWithTokens.map((acc) => (
                      <div
                        key={acc.id}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          setTokenValue(acc.accessToken)
                          setSelectedTokenSource('')
                        }}
                        className="p-3 rounded-xl cursor-pointer text-sm flex items-center gap-3 hover:bg-white/5 transition-all duration-200 group/item"
                      >
                        <div className="w-8 h-8 rounded-full bg-[#E1306C]/10 flex items-center justify-center text-[#E1306C] group-hover/item:scale-110 transition-transform">
                          <Instagram size={16} />
                        </div>
                        <span className="font-semibold text-text-primary">{acc.username}</span>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-error/10 text-error border border-error/20 rounded-2xl text-sm text-center font-medium animate-shake">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={isPending}
            className="mt-4 w-full py-4 rounded-2xl text-lg"
          >
            {isPending ? (
              <Loader2 className="animate-spin mr-2" size={24} />
            ) : (
              <Plus size={20} className="mr-2" />
            )}
            {isPending ? 'Connecting...' : 'Connect Account'}
          </Button>
        </form>
      </Modal>
    </>
  )
}

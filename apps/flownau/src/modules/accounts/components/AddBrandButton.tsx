'use client'

import { useState, useTransition } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { addBrand } from '@/modules/accounts/actions'
import Modal from '@/modules/shared/components/Modal'
import { Button } from '@/modules/shared/components/ui/Button'
import { Input } from '@/modules/shared/components/ui/Input'

export default function AddBrandButton({ workspaceId }: { workspaceId: string }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleClose = () => { setIsOpen(false); setError(null) }

  const handleSubmit = (formData: FormData) => {
    setError(null)
    formData.append('workspaceId', workspaceId)
    startTransition(async () => {
      try {
        const brand = await addBrand(formData)
        handleClose()
        router.push(`/dashboard/workspace/${brand.workspaceId}?brandId=${brand.id}`)
      } catch {
        setError('Failed to create brand. Please try again.')
      }
    })
  }

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        <Plus size={18} className="mr-2" />
        Add Brand
      </Button>

      <Modal isOpen={isOpen} onClose={handleClose}>
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-accent/10 rounded-3xl flex items-center justify-center mx-auto mb-6 text-accent -rotate-3 transition-transform hover:rotate-0 duration-300">
            <Plus size={36} />
          </div>
          <h2 className="text-3xl font-heading font-bold mb-3 tracking-tight">Create Brand</h2>
          <p className="text-text-secondary text-base max-w-[280px] mx-auto">
            Give your brand a name to get started.
          </p>
        </div>

        <form action={handleSubmit} className="flex flex-col gap-6">
          <Input name="brandName" label="Brand Name" placeholder="e.g. Andi Universo" required className="py-4" />

          {error && (
            <div className="p-4 bg-error/10 text-error border border-error/20 rounded-2xl text-sm text-center font-medium">
              {error}
            </div>
          )}

          <Button type="submit" disabled={isPending} className="mt-2 w-full py-4 rounded-2xl text-lg">
            {isPending ? <Loader2 className="animate-spin mr-2" size={22} /> : <Plus size={20} className="mr-2" />}
            {isPending ? 'Creating…' : 'Create Brand'}
          </Button>
        </form>
      </Modal>
    </>
  )
}

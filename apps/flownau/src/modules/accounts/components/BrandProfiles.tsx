'use client'

import { useState, useTransition } from 'react'
import { Instagram, Plus, Trash2, RefreshCw, Loader2, ExternalLink } from 'lucide-react'
import { Card } from '@/modules/shared/components/ui/Card'
import { Button } from '@/modules/shared/components/ui/Button'
import { Input } from '@/modules/shared/components/ui/Input'
import Modal from '@/modules/shared/components/Modal'
import { addSocialProfile, deleteSocialProfile, syncSocialProfile } from '@/modules/accounts/actions'
import { toast } from 'sonner'
import { cn } from '@/modules/shared/utils'
import { useRouter } from 'next/navigation'

type SocialProfile = {
  id: string
  platform: string
  username: string | null
  profileImage: string | null
  platformId: string | null
  tokenExpiresAt: string | null
  createdAt: string
}

export default function BrandProfiles({
  brandId,
  workspaceId,
  initialProfiles,
}: {
  brandId: string
  workspaceId: string
  initialProfiles: SocialProfile[]
}) {
  const router = useRouter()
  const [profiles, setProfiles] = useState<SocialProfile[]>(initialProfiles)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const now = Date.now()

  const handleAdd = (formData: FormData) => {
    setError(null)
    formData.append('brandId', brandId)
    formData.append('workspaceId', workspaceId)
    startTransition(async () => {
      try {
        await addSocialProfile(formData)
        setIsAddOpen(false)
        router.refresh()
      } catch {
        setError('Failed to add social profile. Please check your inputs.')
      }
    })
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await deleteSocialProfile(id)
      setProfiles((p) => p.filter((x) => x.id !== id))
    } catch {
      toast.error('Failed to delete profile')
    } finally {
      setDeletingId(null)
    }
  }

  const handleSync = async (id: string) => {
    setSyncingId(id)
    try {
      await syncSocialProfile(id)
      toast.success('Profile synced')
      router.refresh()
    } catch {
      toast.error('Sync failed')
    } finally {
      setSyncingId(null)
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-heading font-semibold">Publishing Channels</h2>
          <p className="text-text-secondary text-sm mt-1">
            Social profiles where finished content from this brand's pipeline gets posted.
          </p>
        </div>
        <Button onClick={() => setIsAddOpen(true)}>
          <Plus size={16} className="mr-2" />
          Add Profile
        </Button>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
        {profiles.map((profile) => {
          const daysLeft = profile.tokenExpiresAt
            ? Math.ceil((new Date(profile.tokenExpiresAt).getTime() - now) / 86_400_000)
            : null
          const tokenOk = daysLeft === null || daysLeft > 7

          return (
            <Card key={profile.id} className="p-5 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full p-[2px] bg-[linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)] shrink-0 overflow-hidden">
                  <div className="w-full h-full rounded-full bg-panel flex items-center justify-center overflow-hidden">
                    {profile.profileImage ? (
                      <img src={profile.profileImage} alt={profile.username ?? ''} className="w-full h-full object-cover" />
                    ) : (
                      <Instagram size={22} />
                    )}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold truncate">@{profile.username ?? 'syncing…'}</p>
                    {profile.username && (
                      <a
                        href={`https://instagram.com/${profile.username}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-text-secondary hover:text-white transition-colors"
                      >
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary capitalize">{profile.platform}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <div className="flex-1 p-2.5 bg-white/5 rounded-lg text-center">
                  <p className="text-[10px] text-text-secondary uppercase tracking-wider mb-0.5">Token</p>
                  <p className={cn('text-xs font-semibold', tokenOk ? 'text-success' : 'text-red-400')}>
                    {daysLeft !== null ? `${daysLeft}d` : 'No expiry'}
                  </p>
                </div>
                <div className="flex-1 p-2.5 bg-white/5 rounded-lg text-center">
                  <p className="text-[10px] text-text-secondary uppercase tracking-wider mb-0.5">Added</p>
                  <p className="text-xs font-semibold">{new Date(profile.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="flex gap-2 pt-1 border-t border-white/5">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5"
                  disabled={syncingId === profile.id}
                  onClick={() => handleSync(profile.id)}
                >
                  {syncingId === profile.id ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  Sync
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-400 border-red-400/20 hover:bg-red-400/10 gap-1.5"
                  disabled={deletingId === profile.id}
                  onClick={() => handleDelete(profile.id)}
                >
                  {deletingId === profile.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                </Button>
              </div>
            </Card>
          )
        })}

        {profiles.length === 0 && (
          <Card className="col-span-full py-16 text-center border-dashed bg-transparent flex flex-col items-center">
            <Instagram size={40} className="text-text-secondary mb-3 opacity-30" />
            <p className="font-semibold mb-1">No social profiles yet</p>
            <p className="text-text-secondary text-sm mb-5">Add an Instagram Business account to enable publishing.</p>
            <Button onClick={() => setIsAddOpen(true)}>
              <Plus size={16} className="mr-2" />
              Add Profile
            </Button>
          </Card>
        )}
      </div>

      <Modal isOpen={isAddOpen} onClose={() => { setIsAddOpen(false); setError(null) }}>
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-[#E1306C]/10 rounded-3xl flex items-center justify-center mx-auto mb-6 text-[#E1306C]">
            <Instagram size={36} />
          </div>
          <h2 className="text-3xl font-heading font-bold mb-3">Add Social Profile</h2>
          <p className="text-text-secondary text-base max-w-[280px] mx-auto">
            Connect an Instagram Business account as a publishing channel for this brand.
          </p>
        </div>

        <form action={handleAdd} className="flex flex-col gap-5">
          <Input name="username" label="Instagram Username" placeholder="@username" required className="py-4" />
          <Input name="platformId" label="User ID (Platform ID)" placeholder="1784140…" required className="py-4" />
          <div className="w-full">
            <label className="form-label">Access Token</label>
            <input name="accessToken" type="password" className="input-field py-4" placeholder="EAAB…" required />
          </div>

          {error && (
            <div className="p-4 bg-error/10 text-error border border-error/20 rounded-2xl text-sm text-center">
              {error}
            </div>
          )}

          <Button type="submit" disabled={isPending} className="mt-2 w-full py-4 rounded-2xl text-lg">
            {isPending ? <Loader2 className="animate-spin mr-2" size={20} /> : <Plus size={18} className="mr-2" />}
            {isPending ? 'Connecting…' : 'Connect Profile'}
          </Button>
        </form>
      </Modal>
    </div>
  )
}

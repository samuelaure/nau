import { getSetting } from '@/lib/settings'
import SyncButton from './SyncButton'
import ApifyTokenForm from './ApifyTokenForm'

export default async function SettingsPage() {
  const apifyToken = await getSetting('apify_api_token')

  return (
    <div className="animate-fade-in max-w-2xl">
      <header className="mb-10">
        <h1 className="text-3xl font-bold mb-2">System Settings</h1>
        <p className="text-[var(--text-secondary)]">
          Configuration for external services and system-wide behaviors.
        </p>
      </header>

      <div className="card p-8">
        <h3 className="text-xl font-semibold mb-6">Integrations</h3>

        <ApifyTokenForm initialToken={apifyToken || ''} />
      </div>

      <div className="card p-8 mt-6">
        <h3 className="text-xl font-semibold mb-6">Storage & Sync</h3>

        <div>
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-medium mb-1">R2 Assets Sync</h4>
              <p className="text-sm text-[var(--text-secondary)] mb-4 max-w-sm">
                Re-scan the Cloudflare R2 bucket and update the database.
                Useful if files were manually added, moved, or deleted in the storage bucket.
              </p>
            </div>
            <SyncButton />
          </div>
        </div>
      </div>
    </div>
  )
}

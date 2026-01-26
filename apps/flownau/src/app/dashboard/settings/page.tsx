import { getSetting, setSetting } from './actions'

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

        <form action={setSetting} className="grid gap-6">
          <input type="hidden" name="key" value="apify_api_token" />

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              Apify API Token
            </label>
            <div className="flex gap-4">
              <input
                name="value"
                defaultValue={apifyToken || ''}
                placeholder="apify_api_..."
                type="password"
                className="input flex-1"
              />
              <button type="submit" className="btn-primary">
                Save
              </button>
            </div>
            <p className="mt-2 text-xs text-[var(--text-secondary)]">
              Required for Instagram scraping and synchronization.
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}

export const dynamic = 'force-dynamic'

import { getSetting } from '@/modules/shared/settings'
import SyncButton from './SyncButton'
import ApiTokenForm from './ApiTokenForm'
import { Card } from '@/modules/shared/components/ui/Card'

export default async function SettingsPage() {
  const apifyToken = await getSetting('apify_api_token')
  const openaiToken = await getSetting('openai_api_key')
  const groqToken = await getSetting('groq_api_key')

  return (
    <div className="animate-fade-in max-w-2xl">
      <header className="mb-10">
        <h1 className="text-3xl font-heading font-semibold mb-2">System Settings</h1>
        <p className="text-text-secondary">
          Configuration for external services and system-wide behaviors.
        </p>
      </header>

      <Card className="p-8">
        <h3 className="text-xl font-heading font-semibold mb-6">Integrations</h3>

        <ApiTokenForm
          settingKey="apify_api_token"
          label="Apify API Token"
          placeholder="apify_api_..."
          description="Required for Instagram scraping and synchronization."
          initialToken={apifyToken}
        />

        <ApiTokenForm
          settingKey="openai_api_key"
          label="OpenAI API Key"
          placeholder="sk-..."
          description="Required for smart AI planning and composing."
          initialToken={openaiToken}
        />

        <ApiTokenForm
          settingKey="groq_api_key"
          label="Groq API Key"
          placeholder="gsk_..."
          description="Required for fast ideation and basic generation steps."
          initialToken={groqToken}
        />
      </Card>

      <Card className="p-8 mt-6">
        <h3 className="text-xl font-heading font-semibold mb-6">Storage & Sync</h3>

        <div>
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-medium mb-1">R2 Assets Sync</h4>
              <p className="text-sm text-text-secondary mb-4 max-w-sm">
                Re-scan the Cloudflare R2 bucket and update the database. Useful if files were
                manually added, moved, or deleted in the storage bucket.
              </p>
            </div>
            <SyncButton />
          </div>
        </div>
      </Card>
    </div>
  )
}

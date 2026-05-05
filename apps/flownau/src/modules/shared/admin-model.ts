import { getClientForFeature, createLLMClient, type LLMFeature } from '@nau/llm-client'
import type { FeatureClient } from '@nau/llm-client'
import { resolveModelId } from '@/modules/composer/model-resolver'
import { getSetting } from '@/modules/shared/settings'

/**
 * Setting keys used to override LLM models per feature.
 * Admin sets these via the Admin Settings page.
 */
export const ADMIN_MODEL_SETTING_KEYS: Record<AdminModelFeature, string> = {
  ideation:    'model_ideation',
  drafting:    'model_drafting',
  planning:    'model_planning',
}

export type AdminModelFeature = 'ideation' | 'drafting' | 'planning'

const FEATURE_MAP: Record<AdminModelFeature, LLMFeature> = {
  ideation: 'ideation',
  drafting: 'composition',
  planning: 'planning',
}

/**
 * Resolves the LLM client for a feature, checking for an admin override first.
 * Falls back to the @nau/llm-client feature default if no override is set.
 */
export async function getAdminModelClient(feature: AdminModelFeature): Promise<FeatureClient> {
  const settingKey = ADMIN_MODEL_SETTING_KEYS[feature]
  const override = await getSetting(settingKey)

  if (override?.trim()) {
    const { provider, model, registryId } = resolveModelId(override.trim())
    const groqKey = (await getSetting('groq_api_key')) ?? process.env.GROQ_API_KEY ?? null
    const openaiKey = (await getSetting('openai_api_key')) ?? process.env.OPENAI_API_KEY ?? null
    const apiKey = provider === 'groq' ? groqKey : openaiKey
    if (!apiKey) throw new Error(`${provider.toUpperCase()}_API_KEY is not configured`)
    const client = createLLMClient({ provider, apiKey })
    return { client, model, registryId, provider }
  }

  return getClientForFeature(FEATURE_MAP[feature])
}

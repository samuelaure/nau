// ---------------------------------------------------------------------------
// Model Registry — single source of truth for all supported LLM models
// ---------------------------------------------------------------------------
// To onboard a new provider or model: add an entry here. Nothing else changes.

export type ModelCapability =
  | 'chat'             // standard chat completions
  | 'structured'       // structured/parsed output (JSON schema / Zod)
  | 'embedding'        // vector embeddings
  | 'transcription'    // audio-to-text
  | 'reasoning'        // extended thinking / chain-of-thought models

export type LLMProvider = 'openai' | 'groq'

export interface ModelDefinition {
  /** Registry key — used in env overrides: LLM_MODEL_<FEATURE>=<registryId> */
  id: string
  provider: LLMProvider
  /** Exact model string passed to the provider API */
  apiModel: string
  capabilities: ModelCapability[]
  description?: string
}

/** All models known to the platform. Add new ones here. */
export const MODEL_REGISTRY: Record<string, ModelDefinition> = {
  // ── OpenAI ────────────────────────────────────────────────────────────────
  'openai/gpt-4o': {
    id: 'openai/gpt-4o',
    provider: 'openai',
    apiModel: 'gpt-4o',
    capabilities: ['chat', 'structured'],
    description: 'OpenAI GPT-4o — flagship multimodal model',
  },
  'openai/gpt-4o-mini': {
    id: 'openai/gpt-4o-mini',
    provider: 'openai',
    apiModel: 'gpt-4o-mini',
    capabilities: ['chat', 'structured'],
    description: 'OpenAI GPT-4o Mini — fast and cost-efficient',
  },
  'openai/gpt-4-turbo': {
    id: 'openai/gpt-4-turbo',
    provider: 'openai',
    apiModel: 'gpt-4-turbo',
    capabilities: ['chat', 'structured'],
  },
  'openai/gpt-4.1': {
    id: 'openai/gpt-4.1',
    provider: 'openai',
    apiModel: 'gpt-4.1',
    capabilities: ['chat', 'structured'],
    description: 'OpenAI GPT-4.1',
  },
  'openai/o1': {
    id: 'openai/o1',
    provider: 'openai',
    apiModel: 'o1',
    capabilities: ['chat', 'reasoning'],
    description: 'OpenAI o1 — extended reasoning',
  },
  'openai/o1-mini': {
    id: 'openai/o1-mini',
    provider: 'openai',
    apiModel: 'o1-mini',
    capabilities: ['chat', 'reasoning'],
  },
  'openai/text-embedding-3-small': {
    id: 'openai/text-embedding-3-small',
    provider: 'openai',
    apiModel: 'text-embedding-3-small',
    capabilities: ['embedding'],
    description: 'OpenAI text-embedding-3-small — fast, cheap embeddings',
  },
  'openai/text-embedding-3-large': {
    id: 'openai/text-embedding-3-large',
    provider: 'openai',
    apiModel: 'text-embedding-3-large',
    capabilities: ['embedding'],
  },
  'openai/whisper-1': {
    id: 'openai/whisper-1',
    provider: 'openai',
    apiModel: 'whisper-1',
    capabilities: ['transcription'],
    description: 'OpenAI Whisper — audio transcription',
  },
  'local/whisper': {
    id: 'local/whisper',
    provider: 'openai',
    apiModel: 'Systran/faster-whisper-base',
    capabilities: ['transcription'],
    description: 'Self-hosted Whisper via OpenAI-compatible endpoint (requires WHISPER_BASE_URL)',
  },
  // ── Groq ──────────────────────────────────────────────────────────────────
  'groq/llama-3.3-70b': {
    id: 'groq/llama-3.3-70b',
    provider: 'groq',
    apiModel: 'llama-3.3-70b-versatile',
    capabilities: ['chat', 'structured'],
    description: 'Meta Llama 3.3 70B via Groq — fast inference',
  },
  'groq/llama-3.1-70b': {
    id: 'groq/llama-3.1-70b',
    provider: 'groq',
    apiModel: 'llama-3.1-70b-versatile',
    capabilities: ['chat', 'structured'],
  },
  'groq/llama-3.1-8b': {
    id: 'groq/llama-3.1-8b',
    provider: 'groq',
    apiModel: 'llama3-8b-8192',
    capabilities: ['chat'],
    description: 'Meta Llama 3.1 8B via Groq — lightest, fastest',
  },
  'groq/mixtral-8x7b': {
    id: 'groq/mixtral-8x7b',
    provider: 'groq',
    apiModel: 'mixtral-8x7b-32768',
    capabilities: ['chat'],
  },
  'groq/deepseek-r1-70b': {
    id: 'groq/deepseek-r1-70b',
    provider: 'groq',
    apiModel: 'deepseek-r1-distill-llama-70b',
    capabilities: ['chat', 'reasoning'],
  },
}

/** Resolve a registry ID to its definition. Throws for unknown IDs. */
export function resolveModel(id: string): ModelDefinition {
  const def = MODEL_REGISTRY[id]
  if (!def) {
    throw new Error(
      `@nau/llm-client: unknown model "${id}". ` +
        `Add it to packages/llm-client/src/registry.ts to register it.`,
    )
  }
  return def
}

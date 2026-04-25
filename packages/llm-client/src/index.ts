// ---------------------------------------------------------------------------
// @nau/llm-client — LLM abstraction layer for the naŭ Platform
//
// How to use:
//   import { getClientForFeature } from '@nau/llm-client'
//
//   const { client, model } = getClientForFeature('ideation')
//   const result = await client.parseCompletion({ model, schema, messages })
//
// To change which model powers a feature: edit src/features.ts (no app code changes).
// To add a new provider or model: edit src/registry.ts (no app code changes).
// To override at runtime: set LLM_MODEL_<FEATURE>=<registryId> in env.
// ---------------------------------------------------------------------------

export type {
  LLMClient,
  LLMUsage,
  ChatMessage,
  ChatCompletionOptions,
  ChatCompletionResult,
  ParsedCompletionOptions,
  ParsedCompletionResult,
  EmbeddingOptions,
  EmbeddingResult,
  TranscriptionOptions,
  TranscriptionResult,
} from './types'

export { reportUsage } from './usage-reporter'
export type { UsageReportOptions } from './usage-reporter'

export type { LLMFeature } from './features'
export type { ModelDefinition, ModelCapability, LLMProvider } from './registry'
export { getFeatureModelMap } from './features'
export { MODEL_REGISTRY } from './registry'

// Re-export file utility needed for audio transcription uploads
export { toFile } from 'openai'

// ---------------------------------------------------------------------------
// Primary API — feature-based client resolution
// ---------------------------------------------------------------------------

import { resolveFeatureModel, type LLMFeature } from './features'
import { type LLMClient } from './types'

export interface FeatureClient {
  /** Ready-to-use LLM client for this feature */
  client: LLMClient
  /** The exact model string to pass to client methods */
  model: string
  /** The registry ID that was resolved (for logging/usage tracking) */
  registryId: string
  /** The provider name (for usage tracking) */
  provider: string
}

/**
 * Returns the LLM client and model configured for a given platform feature.
 *
 * This is the primary entry point. App code should always use this function.
 *
 * @example
 * const { client, model } = getClientForFeature('ideation')
 * const result = await client.parseCompletion({ model, schema: MySchema, messages })
 */
export function getClientForFeature(feature: LLMFeature): FeatureClient {
  const modelDef = resolveFeatureModel(feature)
  const client = createProviderClient(modelDef.provider)
  return {
    client,
    model: modelDef.apiModel,
    registryId: modelDef.id,
    provider: modelDef.provider,
  }
}

// ---------------------------------------------------------------------------
// Lower-level factory — used internally and by scene-composer (data-driven)
// ---------------------------------------------------------------------------

export type { LLMClientConfig } from './factory'
export { createLLMClient } from './factory'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function createProviderClient(provider: string): LLMClient {
  const apiKey = resolveApiKey(provider)
  return createLLMClientInternal(provider, apiKey)
}

function resolveApiKey(provider: string): string {
  const explicit = process.env.LLM_API_KEY
  if (explicit) return explicit

  if (provider === 'groq') {
    const key = process.env.GROQ_API_KEY
    if (!key) throw new Error(`@nau/llm-client: GROQ_API_KEY is required for provider "groq"`)
    return key
  }

  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error(`@nau/llm-client: OPENAI_API_KEY is required for provider "openai"`)
  return key
}

function createLLMClientInternal(provider: string, apiKey: string): LLMClient {
  switch (provider) {
    case 'openai': {
      const { OpenAIClient } = require('./openai-client')
      return new OpenAIClient(apiKey)
    }
    case 'groq': {
      const { GroqClient } = require('./groq-client')
      return new GroqClient(apiKey)
    }
    default:
      throw new Error(`@nau/llm-client: unknown provider "${provider}". Add it to src/registry.ts.`)
  }
}

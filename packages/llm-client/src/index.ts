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

// ---------------------------------------------------------------------------
// Provider factory — callers use LLMClient interface, never concrete classes
// ---------------------------------------------------------------------------

export type LLMProvider = 'openai' | 'groq'

export interface LLMClientConfig {
  provider: LLMProvider
  apiKey: string
}

export function createLLMClient(config: LLMClientConfig): import('./types').LLMClient {
  switch (config.provider) {
    case 'openai': {
      const { OpenAIClient } = require('./openai-client')
      return new OpenAIClient(config.apiKey)
    }
    case 'groq': {
      const { GroqClient } = require('./groq-client')
      return new GroqClient(config.apiKey)
    }
    default:
      throw new Error(`Unknown LLM provider: ${(config as LLMClientConfig).provider}`)
  }
}

/**
 * Creates an LLM client from environment variables.
 *
 * Reads:
 *   LLM_PROVIDER = "openai" | "groq"  (default: "openai")
 *   LLM_API_KEY                        (overrides provider-specific key)
 *   OPENAI_API_KEY                     (used when provider = openai)
 *   GROQ_API_KEY                       (used when provider = groq)
 *
 * To switch to a self-hosted LLM or a different provider in the future,
 * change LLM_PROVIDER and LLM_API_KEY in env — no application code changes needed.
 */
export function createDefaultLLMClient(): import('./types').LLMClient {
  const provider = (process.env.LLM_PROVIDER ?? 'openai') as LLMProvider
  const apiKey =
    process.env.LLM_API_KEY ??
    (provider === 'groq' ? process.env.GROQ_API_KEY : process.env.OPENAI_API_KEY) ??
    ''

  if (!apiKey) {
    throw new Error(
      `LLM client: no API key found for provider "${provider}". ` +
        `Set LLM_API_KEY, or ${provider === 'groq' ? 'GROQ_API_KEY' : 'OPENAI_API_KEY'}.`,
    )
  }

  return createLLMClient({ provider, apiKey })
}

// Re-export file utility for audio transcription (provider-agnostic helper)
export { toFile } from 'openai'

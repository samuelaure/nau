import type { LLMClient } from './types'
import type { LLMProvider } from './registry'

export interface LLMClientConfig {
  provider: LLMProvider
  apiKey: string
}

/**
 * Creates a client for an explicit provider/key combination.
 *
 * Use this only when the provider is determined at runtime from data
 * (e.g. scene-composer resolves model from a user's persona config).
 *
 * For all other cases, prefer getClientForFeature() from index.ts.
 */
export function createLLMClient(config: LLMClientConfig): LLMClient {
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
      throw new Error(
        `@nau/llm-client: unknown provider "${(config as LLMClientConfig).provider}". ` +
          `Add it to src/registry.ts.`,
      )
  }
}

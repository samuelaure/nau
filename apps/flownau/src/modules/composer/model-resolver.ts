import type { AIModel } from '@prisma/client'
import { MODEL_REGISTRY, type LLMProvider } from '@nau/llm-client'

/**
 * Resolved AI model information — maps a persona's AIModel enum to the
 * registry ID and API model string from @nau/llm-client.
 */
export interface ResolvedModel {
  provider: LLMProvider
  model: string
  registryId: string
}

/**
 * Maps AIModel enum values to their @nau/llm-client registry IDs.
 *
 * Registry IDs must match entries in packages/llm-client/src/registry.ts.
 * When a model is removed or renamed: update both here and in the registry.
 */
const MODEL_MAP: Record<AIModel, string> = {
  OPENAI_GPT_4O:       'openai/gpt-4o',
  OPENAI_GPT_4O_MINI:  'openai/gpt-4o-mini',
  OPENAI_GPT_4_TURBO:  'openai/gpt-4-turbo',
  OPENAI_GPT_4_1:      'openai/gpt-4.1',
  OPENAI_O1:           'openai/o1',
  OPENAI_O1_MINI:      'openai/o1-mini',
  GROQ_LLAMA_3_3:         'groq/llama-3.3-70b',
  GROQ_LLAMA_3_1_70B:     'groq/llama-3.1-70b',
  GROQ_LLAMA_3_1_8B:      'groq/llama-3.1-8b',
  GROQ_MIXTRAL_8X7B:      'groq/mixtral-8x7b',
  GROQ_DEEPSEEK_R1_70B:   'groq/deepseek-r1-70b',
}

const DEFAULT_REGISTRY_ID = 'groq/llama-3.3-70b'

/**
 * Resolves an AIModel enum value to provider + API model string.
 * Uses the @nau/llm-client registry as the source of truth.
 */
export function resolveModelId(modelSelection: AIModel | string): ResolvedModel {
  const registryId = MODEL_MAP[modelSelection as AIModel] ?? DEFAULT_REGISTRY_ID
  const def = MODEL_REGISTRY[registryId] ?? MODEL_REGISTRY[DEFAULT_REGISTRY_ID]

  return {
    provider: def.provider as LLMProvider,
    model: def.apiModel,
    registryId: def.id,
  }
}

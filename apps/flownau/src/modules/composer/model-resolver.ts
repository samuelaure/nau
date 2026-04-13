import type { AIModel } from '@prisma/client'

/**
 * Resolved AI model information.
 * Provider determines which SDK to instantiate.
 * Model is the API model string to pass to the SDK.
 */
export interface ResolvedModel {
  provider: 'openai' | 'groq'
  model: string
}

/**
 * Maps an AIModel enum value to its provider and API model string.
 *
 * This is the SINGLE SOURCE OF TRUTH for model resolution.
 * Previously duplicated across agent.ts, builderAgent.ts, and ideation.service.ts.
 */
const MODEL_MAP: Record<AIModel, ResolvedModel> = {
  OPENAI_GPT_4O: { provider: 'openai', model: 'gpt-4o' },
  OPENAI_GPT_4O_MINI: { provider: 'openai', model: 'gpt-4o-mini' },
  OPENAI_GPT_4_TURBO: { provider: 'openai', model: 'gpt-4-turbo' },
  OPENAI_GPT_4_1: { provider: 'openai', model: 'gpt-4.1' },
  OPENAI_O1: { provider: 'openai', model: 'o1' },
  OPENAI_O1_MINI: { provider: 'openai', model: 'o1-mini' },
  GROQ_LLAMA_3_3: { provider: 'groq', model: 'llama-3.3-70b-versatile' },
  GROQ_LLAMA_3_1_70B: { provider: 'groq', model: 'llama-3.1-70b-versatile' },
  GROQ_LLAMA_3_1_8B: { provider: 'groq', model: 'llama3-8b-8192' },
  GROQ_MIXTRAL_8X7B: { provider: 'groq', model: 'mixtral-8x7b-32768' },
  GROQ_DEEPSEEK_R1_70B: { provider: 'groq', model: 'deepseek-r1-distill-llama-70b' },
}

/** Default model when the enum value is unrecognized */
const DEFAULT_MODEL: ResolvedModel = { provider: 'groq', model: 'llama-3.3-70b-versatile' }

/**
 * Resolves an AIModel enum value to provider + model string.
 *
 * @example
 * const { provider, model } = resolveModelId('GROQ_LLAMA_3_3')
 * // { provider: 'groq', model: 'llama-3.3-70b-versatile' }
 */
export function resolveModelId(modelSelection: AIModel | string): ResolvedModel {
  return MODEL_MAP[modelSelection as AIModel] ?? DEFAULT_MODEL
}

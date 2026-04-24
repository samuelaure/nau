// ---------------------------------------------------------------------------
// Feature routing — maps platform features to their default model
// ---------------------------------------------------------------------------
//
// This is the SINGLE PLACE to change which model powers which feature.
//
// Override any feature at runtime via environment variables:
//   LLM_MODEL_<FEATURE_UPPER>=<registryId>
//   e.g.  LLM_MODEL_IDEATION=groq/llama-3.3-70b
//         LLM_MODEL_EMBEDDING=openai/text-embedding-3-large
//
// Future: this mapping will also be readable from a DB settings table,
// enabling a per-workspace/per-brand settings panel without code changes.

import { resolveModel, type ModelDefinition } from './registry'

/**
 * All named features in the platform that make LLM calls.
 * Add a new feature here when a new LLM-powered capability is built.
 */
export type LLMFeature =
  | 'default'              // fallback for any uncategorised call
  | 'ideation'             // content idea generation (flownau)
  | 'composition'          // scene/creative direction generation (flownau)
  | 'triage'               // GTD triage of raw text captures (api)
  | 'planning'             // scheduling/ordering content pieces (flownau)
  | 'template_compile'     // template schema → system prompt compilation (flownau)
  | 'journal_summary'      // hierarchical journal summaries (api)
  | 'comment_suggestions'  // Instagram comment suggestions (nauthenticity)
  | 'post_intelligence'    // post hook/theme/sentiment extraction (nauthenticity)
  | 'synthesis'            // brand creative synthesis (nauthenticity)
  | 'benchmark'            // benchmark comment generation (nauthenticity)
  | 'embedding'            // vector embeddings (nauthenticity)
  | 'transcription'        // audio transcription (zazu-bot)

/**
 * Default feature → model registry ID mapping.
 *
 * To switch a feature to a different model: change the registry ID here.
 * The provider, API key, and client are all resolved automatically.
 */
const DEFAULT_FEATURE_MODELS: Record<LLMFeature, string> = {
  default:             'openai/gpt-4o',
  ideation:            'openai/gpt-4o',
  composition:         'openai/gpt-4o',
  triage:              'openai/gpt-4o',
  planning:            'openai/gpt-4o-mini',
  template_compile:    'openai/gpt-4o',
  journal_summary:     'openai/gpt-4o',
  comment_suggestions: 'openai/gpt-4o-mini',
  post_intelligence:   'openai/gpt-4o-mini',
  synthesis:           'openai/gpt-4o',
  benchmark:           'openai/gpt-4o-mini',
  embedding:           'openai/text-embedding-3-small',
  transcription:       'openai/whisper-1',
}

/** Convert a feature name to its env-var override key. */
function featureEnvKey(feature: LLMFeature): string {
  return `LLM_MODEL_${feature.toUpperCase().replace(/-/g, '_')}`
}

/**
 * Resolves the active model definition for a feature.
 *
 * Resolution order:
 *   1. Environment variable  LLM_MODEL_<FEATURE>
 *   2. DEFAULT_FEATURE_MODELS table above
 */
export function resolveFeatureModel(feature: LLMFeature): ModelDefinition {
  const envOverride = process.env[featureEnvKey(feature)]
  const registryId = envOverride ?? DEFAULT_FEATURE_MODELS[feature]
  return resolveModel(registryId)
}

/**
 * Returns all current feature→model assignments (useful for admin/debug endpoints).
 */
export function getFeatureModelMap(): Record<LLMFeature, { registryId: string; apiModel: string; provider: string }> {
  const result = {} as Record<LLMFeature, { registryId: string; apiModel: string; provider: string }>
  for (const feature of Object.keys(DEFAULT_FEATURE_MODELS) as LLMFeature[]) {
    const def = resolveFeatureModel(feature)
    result[feature] = { registryId: def.id, apiModel: def.apiModel, provider: def.provider }
  }
  return result
}

import OpenAI from 'openai'
import { z } from 'zod'
import type {
  LLMClient,
  ChatCompletionOptions,
  ChatCompletionResult,
  ParsedCompletionOptions,
  ParsedCompletionResult,
  EmbeddingOptions,
  EmbeddingResult,
  TranscriptionOptions,
  TranscriptionResult,
  LLMUsage,
} from './types'

// Converts a Zod v4 schema to a JSON Schema compatible with OpenAI strict structured output.
// OpenAI strict mode requires: additionalProperties:false on every object and all properties required.
function toOpenAIStrictSchema(schema: z.ZodType): Record<string, unknown> {
  const base = z.toJSONSchema(schema) as Record<string, unknown>
  return enforceStrict(base)
}

function enforceStrict(node: Record<string, unknown>): Record<string, unknown> {
  if (node.type === 'object') {
    const props = (node.properties ?? {}) as Record<string, Record<string, unknown>>
    return {
      ...node,
      additionalProperties: false,
      required: Object.keys(props),
      properties: Object.fromEntries(
        Object.entries(props).map(([k, v]) => [k, enforceStrict(v)]),
      ),
    }
  }
  if (node.type === 'array' && node.items) {
    return { ...node, items: enforceStrict(node.items as Record<string, unknown>) }
  }
  for (const key of ['anyOf', 'oneOf', 'allOf'] as const) {
    if (Array.isArray(node[key])) {
      return {
        ...node,
        [key]: (node[key] as Record<string, unknown>[]).map(enforceStrict),
      }
    }
  }
  return node
}

function makeUsage(
  model: string,
  raw: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null | undefined,
): LLMUsage {
  return {
    model,
    provider: 'openai',
    promptTokens: raw?.prompt_tokens ?? 0,
    completionTokens: raw?.completion_tokens ?? 0,
    totalTokens: raw?.total_tokens ?? 0,
  }
}

export class OpenAIClient implements LLMClient {
  private client: OpenAI

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey })
  }

  async chatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    const completion = await this.client.chat.completions.create(
      {
        model: options.model,
        messages: options.messages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        response_format: options.responseFormat,
      },
      options.timeoutMs ? { timeout: options.timeoutMs } : undefined,
    )

    const content = completion.choices[0]?.message?.content
    if (!content) throw new Error('OpenAI returned empty content')

    return {
      content,
      usage: makeUsage(options.model, completion.usage),
    }
  }

  async parseCompletion<T>(options: ParsedCompletionOptions<T>): Promise<ParsedCompletionResult<T>> {
    const strictSchema = toOpenAIStrictSchema(options.schema)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const completion: any = await this.client.chat.completions.create(
      {
        model: options.model,
        messages: options.messages,
        temperature: options.temperature,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: options.schemaName,
            strict: true,
            schema: strictSchema,
          },
        },
      },
      options.timeoutMs ? { timeout: options.timeoutMs } : undefined,
    )

    const raw: string | null | undefined = completion.choices[0]?.message?.content
    if (!raw) throw new Error('OpenAI returned empty content')

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      throw new Error(`OpenAI returned invalid JSON: ${raw.slice(0, 200)}`)
    }

    return {
      data: options.schema.parse(parsed),
      usage: makeUsage(options.model, completion.usage),
    }
  }

  async createEmbedding(options: EmbeddingOptions): Promise<EmbeddingResult> {
    const response = await this.client.embeddings.create({
      model: options.model,
      input: options.input,
    })

    const embedding = response.data[0]?.embedding
    if (!embedding) throw new Error('OpenAI returned no embedding')

    return {
      embedding,
      usage: makeUsage(options.model, response.usage),
    }
  }

  async transcribe(options: TranscriptionOptions): Promise<TranscriptionResult> {
    const transcription = await this.client.audio.transcriptions.create({
      file: options.file,
      model: options.model,
      language: options.language,
    })

    return { text: transcription.text }
  }
}

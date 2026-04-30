import Groq from 'groq-sdk'
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

function makeUsage(
  model: string,
  raw: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null | undefined,
): LLMUsage {
  return {
    model,
    provider: 'groq',
    promptTokens: raw?.prompt_tokens ?? 0,
    completionTokens: raw?.completion_tokens ?? 0,
    totalTokens: raw?.total_tokens ?? 0,
  }
}

export class GroqClient implements LLMClient {
  private client: Groq

  constructor(apiKey: string) {
    this.client = new Groq({ apiKey })
  }

  async chatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const completion = await (this.client.chat.completions as any).create(
      {
        model: options.model,
        messages: options.messages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
      },
      options.timeoutMs ? { timeout: options.timeoutMs } : undefined,
    )

    const content: string | undefined | null = completion.choices[0]?.message?.content
    if (!content) throw new Error('Groq returned empty content')

    return {
      content,
      usage: makeUsage(options.model, completion.usage),
    }
  }

  async parseCompletion<T>(options: ParsedCompletionOptions<T>): Promise<ParsedCompletionResult<T>> {
    // Groq has no native structured output — append JSON instruction and parse manually
    const messages = [
      ...options.messages,
      {
        role: 'user' as const,
        content: 'Respond with ONLY valid JSON matching the schema. No markdown, no explanation.',
      },
    ]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const completion = await (this.client.chat.completions as any).create(
      {
        model: options.model,
        messages,
        temperature: options.temperature,
      },
      options.timeoutMs ? { timeout: options.timeoutMs } : undefined,
    )

    const raw: string | undefined | null = completion.choices[0]?.message?.content?.trim()
    if (!raw) throw new Error('Groq returned empty response')

    let jsonStr = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    let parsed: unknown
    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      // Groq sometimes outputs JSONL (one object per line) instead of a single object.
      // Try to find the largest/first complete {...} block that contains an array field.
      const firstBrace = jsonStr.indexOf('{')
      const lastBrace = jsonStr.lastIndexOf('}')
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        try {
          parsed = JSON.parse(jsonStr.slice(firstBrace, lastBrace + 1))
        } catch {
          // still invalid — throw original error
          throw new Error(`Groq returned invalid JSON: ${jsonStr.slice(0, 300)}`)
        }
      } else {
        throw new Error(`Groq returned invalid JSON: ${jsonStr.slice(0, 300)}`)
      }
    }

    if (Array.isArray(parsed)) parsed = parsed[0]

    return {
      data: options.schema.parse(parsed),
      usage: makeUsage(options.model, completion.usage),
    }
  }

  async createEmbedding(_options: EmbeddingOptions): Promise<EmbeddingResult> {
    throw new Error('Groq does not support embeddings. Use OpenAI for embedding operations.')
  }

  async transcribe(_options: TranscriptionOptions): Promise<TranscriptionResult> {
    throw new Error('Groq transcription is not supported via this client. Use OpenAI (Whisper).')
  }
}

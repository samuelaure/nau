import OpenAI from 'openai'
import { zodResponseFormat } from 'openai/helpers/zod'
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
    provider: 'openai',
    promptTokens: raw?.prompt_tokens ?? 0,
    completionTokens: raw?.completion_tokens ?? 0,
    totalTokens: raw?.total_tokens ?? 0,
  }
}

export class OpenAIClient implements LLMClient {
  private client: OpenAI

  constructor(apiKey: string, baseURL?: string) {
    this.client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) })
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const completion: any = await (this.client.beta as any).chat.completions.parse(
      {
        model: options.model,
        messages: options.messages,
        temperature: options.temperature,
        response_format: zodResponseFormat(options.schema, options.schemaName),
      },
      options.timeoutMs ? { timeout: options.timeoutMs } : undefined,
    )

    const parsed: unknown = completion.choices[0]?.message?.parsed
    if (parsed === null || parsed === undefined) {
      throw new Error('OpenAI returned empty parsed response')
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

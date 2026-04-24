import type { ZodType } from 'zod'

// ---------------------------------------------------------------------------
// Usage data returned alongside every LLM response
// ---------------------------------------------------------------------------

export interface LLMUsage {
  model: string
  provider: 'openai' | 'groq'
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface ChatCompletionResult {
  content: string
  usage: LLMUsage
}

export interface ParsedCompletionResult<T> {
  data: T
  usage: LLMUsage
}

export interface EmbeddingResult {
  embedding: number[]
  usage: LLMUsage
}

export interface TranscriptionResult {
  text: string
}

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

export type MessageRole = 'system' | 'user' | 'assistant'

export interface ChatMessage {
  role: MessageRole
  content: string
}

export interface ChatCompletionOptions {
  model: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  responseFormat?: { type: 'json_object' }
  timeoutMs?: number
}

export interface ParsedCompletionOptions<T> {
  model: string
  messages: ChatMessage[]
  schema: ZodType<T>
  schemaName: string
  temperature?: number
  timeoutMs?: number
}

export interface EmbeddingOptions {
  model: string
  input: string | string[]
}

export interface TranscriptionOptions {
  model: string
  file: Parameters<import('openai').OpenAI['audio']['transcriptions']['create']>[0]['file']
  fileName?: string
  language?: string
}

// ---------------------------------------------------------------------------
// Client interface
// ---------------------------------------------------------------------------

export interface LLMClient {
  chatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResult>
  parseCompletion<T>(options: ParsedCompletionOptions<T>): Promise<ParsedCompletionResult<T>>
  createEmbedding(options: EmbeddingOptions): Promise<EmbeddingResult>
  transcribe(options: TranscriptionOptions): Promise<TranscriptionResult>
}

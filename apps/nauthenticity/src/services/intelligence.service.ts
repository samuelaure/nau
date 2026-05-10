import { getClientForFeature } from '@nau/llm-client'
import { z } from 'zod'
import { logger } from '../utils/logger'

// ---------------------------------------------------------------------------
// Post Intelligence Extraction
// ---------------------------------------------------------------------------

const IntelligenceSchema = z.object({
  hook: z.string().describe('The primary attention-grabbing opening of the content.'),
  pillars: z.array(z.string()).describe('The core themes or content pillars this post belongs to.'),
  cta: z.string().describe('The call to action provided in the content.'),
  sentiment: z
    .enum(['educational', 'promotional', 'entertaining', 'personal'])
    .describe('The primary tone of the post.'),
  summary: z.string().describe('A concise 1nd or 2nd person summary of the strategy used.'),
})

export type PostIntelligence = z.infer<typeof IntelligenceSchema>

export const extractPostIntelligence = async (
  caption: string,
  transcript: string = '',
): Promise<PostIntelligence> => {
  logger.info('[IntelligenceService] Extracting intelligence...')

  const combinedContent = `
    CAPTION:
    ${caption}

    TRANSCRIPT:
    ${transcript}
  `.trim()

  const { client, model } = getClientForFeature('post_intelligence')
  const result = await client.chatCompletion({
    model,
    messages: [
      {
        role: 'system',
        content: `You are a world-class social media strategist. Analyze the provided Instagram content (caption and/or transcript) to extract its strategic components. You MUST return your answer as a JSON object matching this schema:
        { "hook": string, "pillars": string[], "cta": string, "sentiment": "educational"|"promotional"|"entertaining"|"personal", "summary": string }.`,
      },
      { role: 'user', content: combinedContent },
    ],
    responseFormat: { type: 'json_object' },
  })

  const rawJson = JSON.parse(result.content)
  return IntelligenceSchema.parse(rawJson)
}

// ---------------------------------------------------------------------------
// Comment Suggestion Generation — 5-Level Prompt Architecture
// ---------------------------------------------------------------------------

export interface CommentSuggestionParams {
  post: {
    caption: string
    transcriptText?: string
    url: string
    targetUsername: string
  }
  brand: {
    commentPrompt: string | null
    suggestionsCount: number
  }
  profileCommentPrompt?: string | null
  lastSelectedComments: string[]
}

function buildCommentSystemPrompt(params: CommentSuggestionParams): string {
  const { brand, profileCommentPrompt, lastSelectedComments, post } = params

  const sections: string[] = []

  sections.push(
    `Generate exactly ${brand.suggestionsCount} comment suggestion(s) for the Instagram post below.` +
      ` The comments MUST be written in the same language as the post — detect it from the caption and/or transcript.` +
      ` Return your answer as a JSON object: { "comments": ["string1", "string2", ...] }.`,
  )

  if (brand.commentPrompt?.trim()) {
    sections.push(`\n## COMMENT INSTRUCTIONS\n${brand.commentPrompt.trim()}`)
  }

  if (profileCommentPrompt?.trim()) {
    sections.push(`\n## SPECIFIC INSTRUCTIONS FOR @${post.targetUsername}\n${profileCommentPrompt.trim()}`)
  }

  if (lastSelectedComments.length > 0) {
    const numbered = lastSelectedComments.map((c, i) => `${i + 1}. ${c}`).join('\n')
    sections.push(
      `\n## RECENT COMMENTS SENT BY THIS BRAND\n` +
        `(Use these for consistency and to avoid exact repetition.)\n` +
        numbered,
    )
  }

  return sections.join('\n')
}

function buildPostUserMessage(post: CommentSuggestionParams['post']): string {
  const lines: string[] = [`POST TO COMMENT ON:`, `URL: ${post.url}`]

  if (post.caption?.trim()) {
    lines.push(`\nCaption:\n${post.caption.trim()}`)
  }

  if (post.transcriptText?.trim()) {
    lines.push(`\nVideo Transcript:\n${post.transcriptText.trim()}`)
  }

  return lines.join('\n')
}

export const generateCommentSuggestions = async (
  params: CommentSuggestionParams,
): Promise<string[]> => {
  logger.info(
    `[IntelligenceService] Generating ${params.brand.suggestionsCount} comment suggestion(s) for @${params.post.targetUsername}...`,
  )

  const CommentSuggestionSchema = z.object({
    comments: z.array(z.string().min(1)).length(params.brand.suggestionsCount),
  })

  const systemPrompt = buildCommentSystemPrompt(params)
  const userMessage = buildPostUserMessage(params.post)

  const { client, model } = getClientForFeature('comment_suggestions')
  const result = await client.chatCompletion({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    responseFormat: { type: 'json_object' },
  })

  const rawJson = JSON.parse(result.content) as unknown
  return CommentSuggestionSchema.parse(rawJson).comments
}

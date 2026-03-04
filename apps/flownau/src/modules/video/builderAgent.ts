import { prisma } from '@/modules/shared/prisma'
import { DynamicCompositionSchema } from '@/modules/rendering/DynamicComposition/schema'
import OpenAI from 'openai'
import Groq from 'groq-sdk'

const BASE_NATIVE_CREATION_RULES = `
You are a Senior Video Layout Engineer. You receive a JSON sequence representing a Remotion application timeline. 
Your ONLY job is to apply the EXPLICIT modifications requested by the user and return ONLY the modified JSON structure.

### NATIVE JSON STRUCTURE RULES:
- Output ONLY valid JSON without markdown formatting.
- Tracks: MUST contain 'media', 'text', and 'audio' arrays.
- Text Objects: MUST include 'id', 'type', 'content', 'startFrame', 'durationInFrames', 'safeZone', 'fontSize', 'color' (Hex), 'animation'.
- Media Objects: MUST include 'id', 'type', 'assetUrl', 'startFrame', 'durationInFrames', 'mediaStartAt', 'scale' (cover/contain).
- All IDs must be unique strings.
- Total duration is typically 300-450 frames (10-15s @ 30fps).
`

export async function iterateTemplateWithAgent(
  currentJson: any,
  userPrompt: string,
  accountId?: string,
  templateId?: string,
  overridePrompt?: string,
): Promise<any> {
  // 1. Resolve Prompts Hierarchy
  let accountCreationPrompt = ''
  let templateCreationPrompt = overridePrompt ? `\nTEMPORAL RULES:\n${overridePrompt}` : ''
  let preferredModel = 'llama-3.3-70b-versatile'
  let provider: 'groq' | 'openai' = 'groq'

  if (accountId) {
    const account = (await prisma.socialAccount.findUnique({
      where: { id: accountId },
      include: { brandPersonas: { where: { isDefault: true } } },
    })) as any
    if (account?.creationPrompt)
      accountCreationPrompt = `\nBRAND GUIDELINES:\n${account.creationPrompt}`

    // Pick the default persona's model if available
    const persona = account?.brandPersonas?.[0]
    if (persona) {
      provider = persona.modelSelection.startsWith('OPENAI') ? 'openai' : 'groq'
      preferredModel =
        persona.modelSelection === 'GROQ_LLAMA_3_3'
          ? 'llama-3.3-70b-versatile'
          : persona.modelSelection === 'OPENAI_GPT_4O'
            ? 'gpt-4o'
            : persona.modelSelection === 'OPENAI_GPT_4O_MINI'
              ? 'gpt-4o-mini'
              : persona.modelSelection === 'OPENAI_GPT_4_TURBO'
                ? 'gpt-4-turbo'
                : persona.modelSelection === 'OPENAI_GPT_4_1'
                  ? 'gpt-4-turbo'
                  : 'llama-3.3-70b-versatile'
    }
  }

  if (templateId && !overridePrompt) {
    const template = (await prisma.template.findUnique({ where: { id: templateId } })) as any
    if (template?.creationPrompt)
      templateCreationPrompt = `\nTEMPLATE SPECIFIC RULES:\n${template.creationPrompt}`
  }

  const finalSystemPrompt = `${BASE_NATIVE_CREATION_RULES}${accountCreationPrompt}${templateCreationPrompt}

Current JSON Timeline state:
${JSON.stringify(currentJson, null, 2)}

Ensure the resulting JSON strictly matches the schema. Output JSON ONLY.`

  const client =
    provider === 'groq'
      ? new Groq({ apiKey: process.env.GROQ_API_KEY })
      : new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  let attempts = 0
  let lastError = ''
  let finalJsonResult: any = null

  while (attempts < 2) {
    attempts++
    try {
      const chatCompletion = await (client as any).chat.completions.create({
        model: preferredModel,
        messages: [
          {
            role: 'system',
            content: `${finalSystemPrompt}${lastError ? `\n\n### PREVIOUS ERROR:\nYour last output was invalid: ${lastError}\nPlease fix and try again.` : ''}`,
          },
          { role: 'user', content: `Please modify the template: "${userPrompt}"` },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      })

      const rawContent = chatCompletion.choices[0]?.message?.content
      if (!rawContent) throw new Error('AI returned an empty response')

      const jsonObject = JSON.parse(rawContent)
      // Extract from common wrappers
      const resultObject =
        jsonObject.schemaJson || jsonObject.data || jsonObject.composition || jsonObject.tracks
          ? jsonObject
          : jsonObject.data

      finalJsonResult = DynamicCompositionSchema.parse(resultObject)
      return finalJsonResult
    } catch (error: any) {
      console.warn(`[ITERATE_AGENT_FAILURE] Attempt ${attempts}:`, error.message)
      lastError = error.message
      if (attempts >= 2) throw new Error(`Iterate agent failed after 2 attempts: ${error.message}`)
    }
  }
}

export async function generateTemplateDescription(finalJson: any): Promise<string> {
  if (!process.env.GROQ_API_KEY) {
    return 'Default fallback description since Groq is unavailable.'
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

  try {
    const chatCompletion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are an AI assistant. I will provide you with a JSON video template structure.
Your job is to write a succinct 1 to 2 sentence description explaining what this template is structurally best used for.
Focus on the number of media objects required, the length/placement of texts, and tone.
Example: "Best for top-3 lists. Requires 3 back-to-back rapid cut videos and large centered text blocks."
Return ONLY the description string.`,
        },
        {
          role: 'user',
          content: `Analyze this template and return the description:\n${JSON.stringify(finalJson)}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 100,
    })

    return (
      chatCompletion.choices[0]?.message?.content?.trim() || 'Custom intelligent video template.'
    )
  } catch (error) {
    console.error('[GROQ_DESCRIBE_AGENT_ERROR]', error)
    return 'Dynamic Video Layout Template.'
  }
}

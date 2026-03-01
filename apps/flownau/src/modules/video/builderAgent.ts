import Groq from 'groq-sdk'
import { DynamicCompositionSchema } from '@/modules/rendering/DynamicComposition/schema'

export async function iterateTemplateWithAgent(currentJson: any, userPrompt: string): Promise<any> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured in .env')
  }

  const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
  })

  try {
    const chatCompletion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are a Senior Video Layout Engineer. You receive a JSON sequence representing a Remotion application timeline. 
Your ONLY job is to apply the EXPLICIT modifications requested by the user and return ONLY the modified JSON structure.

Current JSON Timeline state:
${JSON.stringify(currentJson, null, 2)}

Ensure the resulting JSON strictly matches the known DynamicCompositionSchema format exactly.
You must output ONLY valid JSON without any markdown formatting or explanations.`,
        },
        {
          role: 'user',
          content: `Please modify the template: "${userPrompt}"`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    })

    const rawContent = chatCompletion.choices[0]?.message?.content
    if (!rawContent) throw new Error('Groq returned an empty response')

    const jsonObject = JSON.parse(rawContent)

    // Check if the model wrapped the response implicitly
    const resultObject = jsonObject.schemaJson
      ? jsonObject.schemaJson
      : jsonObject.data || jsonObject.composition || jsonObject

    return DynamicCompositionSchema.parse(resultObject)
  } catch (error: unknown) {
    console.error('[GROQ_ITERATE_AGENT_ERROR]', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Groq iterate agent failed: ${msg}`)
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

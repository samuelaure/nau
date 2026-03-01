import Groq from 'groq-sdk'
import { prisma } from '@/modules/shared/prisma'
import { z } from 'zod'

export const AgentOutputSchema = z.object({
  _thought: z.string(),
  templateId: z.string(),
  textSlots: z.record(z.string(), z.string()),
  mediaSlots: z.record(z.string(), z.string()),
})

export type AgentOutputType = z.infer<typeof AgentOutputSchema>

export async function composeVideoWithAgent(
  prompt: string,
  accountId: string,
  format: 'reel' | 'post' | 'story',
): Promise<AgentOutputType> {
  // 1. Fetch available brand assets
  const allAssets = await prisma.asset.findMany({
    where: {
      accountId,
      NOT: {
        OR: [
          { r2Key: { contains: 'outputs/', mode: 'insensitive' } },
          { r2Key: { contains: 'output/', mode: 'insensitive' } },
        ],
      },
    },
    select: { id: true, type: true, url: true, originalFilename: true, r2Key: true },
    take: 60,
  })

  const assetsContext =
    allAssets.length > 0
      ? allAssets
          .map((a) => `- ID: ${a.id} URL: ${a.url} (Type: ${a.type}, Name: ${a.originalFilename})`)
          .join('\n')
      : 'No brand assets available.'

  // 2. Fetch Active Sequence Templates
  const activeTemplates = await prisma.videoTemplate.findMany({
    where: { isActive: true },
  })

  if (activeTemplates.length === 0) {
    throw new Error('No active templates available in the database. Please create one first.')
  }

  const templatesContext = activeTemplates
    .map((t) => {
      const schema = t.schemaJson as any
      const textSlots = schema?.tracks?.text?.map((n: any) => n.id) || []
      const mediaSlots = schema?.tracks?.media?.map((n: any) => n.id) || []
      const audioSlots = schema?.tracks?.audio?.map((n: any) => n.id) || []

      return `### TEMPLATE ID: ${t.id}
Name: ${t.name}
Description: ${t.description}
Text Slots Available: [${textSlots.join(', ')}]
Media Slots Available: [${mediaSlots.join(', ')}]
Audio Slots Available: [${audioSlots.join(', ')}]`
    })
    .join('\n\n')

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
          content: `You are a Senior Creative Director Director. Your task is to select the most appropriate Video Template and assign content to its slots based on the target prompt tone.

AVAILABLE TEMPLATES:
${templatesContext}

AVAILABLE ASSETS (Use exact URLs returned here):
${assetsContext}

OUTPUT FORMAT STRICTLY THIS JSON:
{
  "_thought": "Explain why you chose this template over others, and why you placed specific assets.",
  "templateId": "exact string ID from the chosen template above",
  "textSlots": {
    "slot_id_1": "Your generated engaging text here",
    "slot_id_2": "Another text"
  },
  "mediaSlots": {
    "media_slot_1": "exact asset URL from AVAILABLE ASSETS",
    "audio_slot_1": "exact audio URL from AVAILABLE ASSETS"
  }
}

RULES:
- You MUST select ONE active templateId from the list.
- Do NOT hallucinate math bounding boxes or durations.
- For "textSlots": populate every slot ID listed for your chosen template. Keep text concise.
- For "mediaSlots": populate every media and audio slot ID if applicable, using ONLY valid URLs from the assets provided.
- Return ONLY valid JSON.`,
        },
        {
          role: 'user',
          content: `Generate creative instructions for the following prompt: "${prompt}" - Format: ${format}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    })

    const rawContent = chatCompletion.choices[0]?.message?.content
    if (!rawContent) throw new Error('Groq returned an empty response')

    console.log('[DEBUG] RAW GROQ TARGET RESPONSE:', rawContent)

    const parsed = JSON.parse(rawContent)
    return AgentOutputSchema.parse(parsed)
  } catch (error: unknown) {
    console.error('[GROQ_AGENT_ERROR]', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Groq Agent failed: ${msg}`)
  }
}

export async function generateContentIdeas(accountId: string): Promise<string[]> {
  const defaultPersona = await prisma.brandPersona.findFirst({
    where: { accountId, isDefault: true },
  })

  // Fallback to first persona if no default is explicitly marked
  const persona =
    defaultPersona ||
    (await prisma.brandPersona.findFirst({
      where: { accountId },
    }))

  if (!persona) {
    throw new Error('No Brand Persona found. Please create one before generating ideas.')
  }

  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured in .env')
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

  try {
    const chatCompletion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are a Lead Content Strategist. 
          
BRAND TONE & PERSONALITY:
${persona.systemPrompt}

IDEATION FRAMEWORK:
${persona.ideasFrameworkPrompt}

Generate exactly 5 distinct, high-performing content ideas following the framework constraints. Focus on the core angle and hook.

OUTPUT STRICTLY THIS JSON FORMAT:
{
  "ideas": [
    "Idea 1 description...",
    "Idea 2 description..."
  ]
}`,
        },
        {
          role: 'user',
          content: `Please generate 5 new content ideas.`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8, // Slightly higher for creativity in ideas
    })

    const rawContent = chatCompletion.choices[0]?.message?.content
    if (!rawContent) throw new Error('Groq returned an empty response')

    const parsed = JSON.parse(rawContent)
    if (!parsed.ideas || !Array.isArray(parsed.ideas))
      throw new Error('Failed to parse ideas array.')

    return parsed.ideas as string[]
  } catch (error: unknown) {
    console.error('[IDEA_GENERATION_ERROR]', error)
    throw new Error('Failed to generate ideas')
  }
}

import Groq from 'groq-sdk'
import { prisma } from '@/modules/shared/prisma'
import { DynamicCompositionSchema } from '@/modules/rendering/DynamicComposition/schema'

/**
 * AI Video Composition Agent using Groq (Llama 3.3 70B)
 * Provides $0 cost, high privacy (no training), and ultra-fast inference.
 */
export async function composeVideoWithAgent(
  prompt: string,
  accountId: string,
  format: 'reel' | 'post' | 'story',
) {
  // 1. Fetch available brand assets (everything EXCEPT anything in 'outputs' folders)
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

  // Format assets for the LLM
  const assetsContext =
    allAssets.length > 0
      ? allAssets
        .map((a) => `- ID: ${a.id}, Type: ${a.type}, Name: ${a.originalFilename}, URL: ${a.url}`)
        .join('\n')
      : 'No assets available.'

  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured in .env')
  }

  const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
  })

  // 2. Execute High-Fidelity Creative Direction
  try {
    const chatCompletion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are a Senior Creative Director. Generate a video composition JSON strictly following this structure:
{
  "_thought": "string detailing your chosen Composition Archetype (e.g., fast-paced trailer, slow narrative), narrative pacing, and why you are choosing specific assets and audio placement.",
  "format": "${format}",
  "fps": 30,
  "durationInFrames": number,
  "width": 1080,
  "height": 1920,
  "scenes": [
    {
      "id": "string",
      "startFrame": number,
      "durationInFrames": number,
      "layout": "full" | "split-horizontal" | "split-vertical",
      "nodes": [
        { "type": "media", "id": "string", "assetUrl": "url", "startFrame": number, "durationInFrames": number, "mediaStartAt": number, "scale": "cover" | "contain" },
        { "type": "text", "id": "string", "content": "string", "startFrame": number, "durationInFrames": number, "safeZone": "top-third" | "center-safe" | "bottom-third", "fontSize": number, "color": "hex", "animation": "fade" | "pop" | "slide-up" | "none" },
        { "type": "audio", "id": "string", "assetUrl": "url", "startFrame": number, "durationInFrames": number, "volume": number }
      ]
    }
  ]
}

RULES:
- DURATION: All \`durationInFrames\` (for the overall video, scenes, and nodes) MUST be an integer greater than 0. Never output 0 duration.
- Use only IDs and URLs from the available assets.
- Ensure scenes flow mathematically without gaps.
- Use 18% horizontal margins.
- BACKGROUND MEDIA: Every scene MUST include a background video or image if available assets are provided. Do not use plain black backgrounds.
- AUDIO INTEGRATION: Do not put a new audio clip on every single scene unless it's a sound effect. For background music, use ONE long audio node in the first scene extending across the total duration.
- COMPOSITION ARCHETYPES: Choose a style. E.g., Fast cuts (every 30-60 frames), or Slow narrative (longer scenes, sparse text). Stick to it.
- Return ONLY the JSON object.

AVAILABLE BRAND ASSETS (Only Videos and Audios):
\${assetsContext}`,
        },
        {
          role: 'user',
          content: `Create a cinematic reel for: "${prompt}"`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    })

    const rawContent = chatCompletion.choices[0]?.message?.content
    if (!rawContent) throw new Error('Groq returned an empty response')

    console.log('[DEBUG] RAW GROQ RESPONSE:', rawContent) // Critical for debugging

    const jsonObject = JSON.parse(rawContent)

    // Check if the model wrapped the response (common fallback)
    const resultObject = jsonObject.scenes
      ? jsonObject
      : jsonObject.composition || jsonObject.data || jsonObject

    return DynamicCompositionSchema.parse(resultObject)
  } catch (error: unknown) {
    console.error('[GROQ_AGENT_ERROR]', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Groq Agent failed: ${msg}`)
  }
}

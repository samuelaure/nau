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
  "_thought": "string detailing your chosen Composition Archetype, narrative pacing, and why you are choosing specific assets and audio placement across the global timeline.",
  "format": "${format}",
  "fps": 30,
  "durationInFrames": number,
  "width": 1080,
  "height": 1920,
  "tracks": {
    "media": [
      { "id": "string", "type": "media", "assetUrl": "url", "startFrame": number, "durationInFrames": number, "mediaStartAt": number, "scale": "cover" | "contain" }
    ],
    "text": [
      { "id": "string", "type": "text", "content": "string", "startFrame": number, "durationInFrames": number, "safeZone": "top-third" | "center-safe" | "bottom-third", "fontSize": number, "color": "hex", "animation": "fade" | "pop" | "slide-up" | "none" }
    ],
    "audio": [
      { "id": "string", "type": "audio", "assetUrl": "url", "startFrame": number, "durationInFrames": number, "volume": number }
    ]
  }
}

RULES:
- DURATION: All \`durationInFrames\` (for the overall video and individual nodes) MUST be an integer greater than 0. Never output 0 duration.
- ASSET VERACITY: Use ONLY IDs and URLs from the AVAILABLE BRAND ASSETS. 
- ANTI-HALLUCINATION: NEVER use placeholder URLs like "example.com" or "video-1.mp4". If no suitable asset is provided, DO NOT include a media or audio node.
- GLOBAL TIMELINE: Nodes are absolute. A single media node in the "media" track can span the entire video (startFrame: 0, durationInFrames: Total), while multiple "text" nodes appear and disappear at intervals.
- Ensure all tracks flow logically without unintended gaps in core background media.
- COMPOSITION ARCHETYPES: Choose a style. E.g., Fast cuts, or Slow narrative. Stick to it.
- Return ONLY the JSON object.

AVAILABLE BRAND ASSETS (Only Videos and Audios):
${assetsContext}`,
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

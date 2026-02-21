import { generateObject } from 'ai'
import { google } from '@ai-sdk/google'
import { prisma } from '@/modules/shared/prisma'
import { DynamicCompositionSchema } from '@/modules/rendering/DynamicComposition/schema'

export async function composeVideoWithAgent(
  prompt: string,
  accountId: string,
  format: 'reel' | 'post' | 'story',
) {
  // 1. Fetch assets and pre-select to save tokens
  const allAssets = await prisma.asset.findMany({
    where: { accountId },
    select: { id: true, type: true, url: true, originalFilename: true },
    take: 20, // Limit to most recent/relevant assets to save tokens
  })

  // Format assets into a compact context string
  const assetsContext =
    allAssets.length > 0
      ? allAssets.map((a) => `- ID: ${a.id}, Type: ${a.type}, URL: ${a.url}`).join('\n')
      : 'No assets available.'

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not configured.')
  }

  // 2. Structure the LLM call with Creative Director intelligence
  try {
    const result = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: DynamicCompositionSchema,
      system: `You are an expert autonomous creative director. 
You are tasked with generating a dynamic video composition schema.
You will be provided with a user prompt and a list of available brand assets.
Your job is to produce a structurally perfect JSON payload that maps to the timeline mathematically.

CREATIVE FREEDOM:
- Do not follow rigid scene-per-background rules. You can have one background video spanning multiple text scenes, or multiple background cuts within one thematic scene.
- DYNAMIC MEDIA OFFSETS: To keep content fresh, avoid always starting videos from frame 0. Use 'mediaStartAt' to pick interesting segments from the available video assets (e.g., start at frame 150 or 300 if the video is long).
- VISUAL STORYTELLING: Understand the emotion of the user's prompt. If it's "energetic", use faster cuts and bolder animations. If it's "meditative", use longer scenes and fades.
- TYPOGRAPHY: Choose safeZones ('top-third', 'center-safe', 'bottom-third') based on where they fit best with the background content. 
  * Note: 'top-third' stays below the notch (15% padding). 'bottom-third' stays above the caption (35% padding). 'center-safe' is perfectly centered.

AVAILABLE BRAND ASSETS:
${assetsContext}

TECHNICAL CONSTRAINTS:
- Format requested: ${format}
- Typical FPS: 30
- Total duration should be determined by the sum of scenes duration or pacing of the prompt.
- For videos and images, ALWAYS use the provided Asset URLs if they match the creative prompt. Never invent fake URLs.
- For each scene, ensure startFrames and durationInFrames mathematical flow makes sense.
- Scene startFrame usually starts where the previous scene left off, or overlap if instructed.
- Place text dynamically and safely (use 'top-third', 'center-safe', 'bottom-third').
- Do not output pixel coordinates, rely strictly on the schema definitions.
- Respect ZOD typings and constraints exactly.`,
      prompt: `Generate a dynamic composition schema for the following prompt: "${prompt}"`,
    })

    return result.object
  } catch (error: unknown) {
    console.error('[AGENT_COMPOSE_API_ERROR] FULL ERROR:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Agent failed to generate composition: ${msg}`)
  }
}

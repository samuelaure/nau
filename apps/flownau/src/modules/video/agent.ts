import { generateObject } from 'ai'
import { google } from '@ai-sdk/google'
import { prisma } from '@/modules/shared/prisma'
import { DynamicCompositionSchema } from '@/modules/rendering/DynamicComposition/schema'

export async function composeVideoWithAgent(
  prompt: string,
  accountId: string,
  format: 'reel' | 'post' | 'story',
) {
  // 1. Fetch assets for the account to include in the context
  const assets = await prisma.asset.findMany({
    where: { accountId },
    select: { id: true, type: true, url: true, thumbnailUrl: true },
  })

  // Format assets into a descriptive context string
  const assetsContext =
    assets.length > 0
      ? assets.map((a) => `- Asset ID: ${a.id}, Type: ${a.type}, URL: ${a.url}`).join('\n')
      : 'No assets available for this account. You must rely on text only or generic placeholders.'

  // Check if API key exists to avoid unhandled SDK errors
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not configured in the environment variables.')
  }

  // 2. Structure the LLM call using generateObject
  try {
    const result = await generateObject({
      model: google('gemini-1.5-flash'), // Rapid & Generous free tier
      schema: DynamicCompositionSchema,
      system: `You are an expert autonomous creative director. 
You are tasked with generating a dynamic video composition schema.
You will be provided with a user prompt and a list of available brand assets.
Your job is to produce a structurally perfect JSON payload that maps to the timeline mathematically.

Available Assets:
${assetsContext}

Constraints:
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
    console.error('[AGENT_COMPOSE_API_ERROR]', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Agent failed to generate composition: ${msg}`)
  }
}

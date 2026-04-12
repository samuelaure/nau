import { prisma } from '@/modules/shared/prisma'
import { Groq } from 'groq-sdk'
import OpenAI from 'openai'
import { logError, logger } from '@/modules/shared/logger'
import {
  DynamicCompositionSchema,
  DynamicCompositionSchemaType,
} from '@/modules/rendering/DynamicComposition/schema'
import { getSetting } from '@/modules/shared/settings'

/**
 * Main AI Agent for Video Composition.
 * Follows a Multi-Step process:
 * 1. Director Choice: Pick the best Template (if not provided).
 * 2. Creative Planning: Brand Persona + Template Prompt -> Narrative Script.
 * 3. Technical Mapping: Narrative Script -> Valid DynamicComposition JSON.
 */
export async function composeVideoWithAgent(
  prompt: string,
  accountId: string,
  format: 'reel' | 'post' | 'story',
  templateId?: string,
  personaId?: string,
): Promise<{ composition: DynamicCompositionSchemaType; templateId: string }> {
  // 1. Fetch Brand Persona
  const persona = (
    personaId
      ? await prisma.brandPersona.findUnique({ where: { id: personaId } })
      : (await prisma.brandPersona.findFirst({ where: { accountId, isDefault: true } })) ||
        (await prisma.brandPersona.findFirst({ where: { accountId } }))
  ) as any

  if (!persona) throw new Error('No Brand Persona found.')

  // 2. Decide Template (Director Role)
  const templates = (await prisma.template.findMany({
    where: { OR: [{ accountId }, { accountId: null }] },
  })) as any[]

  let targetTemplate = templates.find((t) => t.id === templateId)

  const model =
    persona.modelSelection === 'OPENAI_GPT_4O'
      ? 'gpt-4o'
      : persona.modelSelection === 'OPENAI_GPT_4O_MINI'
        ? 'gpt-4o-mini'
        : persona.modelSelection === 'OPENAI_GPT_4_TURBO'
          ? 'gpt-4-turbo'
          : persona.modelSelection === 'OPENAI_GPT_4_1'
            ? 'gpt-4-turbo'
            : persona.modelSelection === 'OPENAI_O1'
              ? 'o1-preview'
              : persona.modelSelection === 'OPENAI_O1_MINI'
                ? 'o1-mini'
                : persona.modelSelection === 'GROQ_LLAMA_3_3'
                  ? 'llama-3.3-70b-versatile'
                  : persona.modelSelection === 'GROQ_LLAMA_3_1_70B'
                    ? 'llama-3.1-70b-versatile'
                    : persona.modelSelection === 'GROQ_LLAMA_3_1_8B'
                      ? 'llama3-8b-8192'
                      : persona.modelSelection === 'GROQ_MIXTRAL_8X7B'
                        ? 'mixtral-8x7b-32768'
                        : persona.modelSelection === 'GROQ_DEEPSEEK_R1_70B'
                          ? 'deepseek-r1-distill-llama-70b'
                          : 'llama-3.3-70b-versatile'

  const isGroq = persona.modelSelection.startsWith('GROQ')
  const groqKey = (await getSetting('groq_api_key')) || process.env.GROQ_API_KEY
  const openaiKey = (await getSetting('openai_api_key')) || process.env.OPENAI_API_KEY

  const client = isGroq ? new Groq({ apiKey: groqKey }) : new OpenAI({ apiKey: openaiKey })

  if (!targetTemplate && templates.length > 0) {
    const account = (await prisma.socialAccount.findUnique({ where: { id: accountId } })) as any
    const directorPrompt =
      account?.directorPrompt || 'Pick the best template for this video concept.'

    const decision = await (client as any).chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `DIRECTOR ROLE: ${directorPrompt}\nAvailable templates:\n${templates.map((t) => `- ID: ${t.id}, Name: ${t.name}`).join('\n')}\nOutput ONLY the ID of the best template.`,
        },
        { role: 'user', content: `Concept: ${prompt}` },
      ],
      temperature: 0,
    })

    const pickedId = decision.choices[0]?.message?.content?.trim().replace(/['"]/g, '')
    targetTemplate = templates.find((t) => t.id === pickedId) || templates[0]
  }

  if (!targetTemplate) throw new Error('No video templates available.')

  // 3. Creative Planning
  const assets = await prisma.asset.findMany({
    where: {
      accountId,
      NOT: {
        OR: [
          { r2Key: { contains: '/outputs/' } },
          { r2Key: { contains: '/Outputs/' } },
          { url: { contains: '/outputs/' } },
          { url: { contains: '/Outputs/' } },
        ],
      },
    },
  })

  // Pre-select random assets to assist the AI in "systematic" selection
  const videos = assets.filter((a) => a.type === 'VID')
  const audios = assets.filter((a) => a.type === 'AUD')

  const randomVideo = videos.length > 0 ? videos[Math.floor(Math.random() * videos.length)] : null
  const randomAudio = audios.length > 0 ? audios[Math.floor(Math.random() * audios.length)] : null

  const creativeResponse = await (client as any).chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: `You are a Senior Creative Director. Create a high-fidelity Creative Plan for a short-form video (Reel/TikTok/Short).
        
BRAND TONE:
${persona.systemPrompt}

TEMPLATE CONTEXT:
${targetTemplate.systemPrompt || "Follow the template's vibe."}

SELECTED ASSETS (System Chosen):
${randomVideo ? `- Video: ${randomVideo.url}` : '- No video available (use overlay/text)'}
${randomAudio ? `- Audio: ${randomAudio.url}` : '- No audio available'}

YOUR TASK:
1. Focus on the NARRATIVE and TEXT OVERLAYS.
2. Determine how the text should flow over the selected assets to fulfill the user's idea.
3. Generate a compelling social media caption.

Output:
1. A numbered plan for the scenes, specifically focusing on TEXT OVERLAYS and their timing.
2. A compelling social media caption (max 2000 chars).`,
      },
      { role: 'user', content: `Prompt: ${prompt}` },
    ],
    temperature: 0.7,
  })

  const creativePlan = creativeResponse.choices[0]?.message?.content
  if (!creativePlan) throw new Error('Creative planning failed.')

  // 4. Technical Mapping with Self-Correction Loop
  let technicalPlan = creativePlan
  let attempts = 0
  let lastError = ''
  let targetJson: any = null

  while (attempts < 2) {
    attempts++
    const technicalResponse = await (client as any).chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You are a Technical Video Engineer. Map the plan to DynamicComposition JSON.
        
### SELECTED ASSET DATA (MANDATORY):
${randomVideo ? `- VIDEO_URL: ${randomVideo.url}` : '- NO_VIDEO'}
${randomAudio ? `- AUDIO_URL: ${randomAudio.url}` : '- NO_AUDIO'}

### SCHEMA SPEC:
- Duration: 300-450 frames (10-15s @ 30fps)
- Tracks: 
  * media: Use VIDEO_URL if provided.
  * audio: Use AUDIO_URL if provided.
  * text: Overlay the generated narrative text.
- Caption: Include the generated caption in the "caption" field.
- JSON Structure:
{
  "format": "${format}",
  "fps": 30,
  "durationInFrames": 450,
  "width": 1080,
  "height": 1920,
  "caption": "Your amazing caption here...",
  "tracks": {
    "media": [ { "id": "1", "type": "media", "assetUrl": "VIDEO_URL", "startFrame": 0, "durationInFrames": 450, "mediaStartAt": 0, "scale": "cover" } ],
    "overlay": [ { "id": "4", "type": "overlay", "color": "#000000", "opacity": 0.4, "startFrame": 0, "durationInFrames": 450 } ],
    "text": [ { "id": "2", "type": "text", "content": "TEXT", "startFrame": 30, "durationInFrames": 90, "safeZone": "center-safe", "fontSize": 80, "color": "#FFFFFF", "animation": "fade" } ],
    "audio": [ { "id": "3", "type": "audio", "assetUrl": "AUDIO_URL", "startFrame": 0, "durationInFrames": 450, "volume": 1 } ]
  }
}

### CRITICAL RULES:
- Output ONLY valid JSON. 
- No comments, no markdown blocks, no triple backticks unless using json mode.
- Ensure all IDs are unique strings.
${lastError ? `\n### PREVIOUS ATTEMPT FAILED WITH ERROR:\n${lastError}\nPlease fix this error specifically.` : ''}`,
        },
        { role: 'user', content: `PLAN: ${technicalPlan}` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
    })

    const rawJson = technicalResponse.choices[0]?.message?.content
    if (!rawJson) throw new Error('Technical mapping failed.')

    try {
      const parsed = JSON.parse(rawJson)
      targetJson = parsed.tracks ? parsed : parsed.composition || parsed.data || parsed

      // Post-process placeholders
      const finalizeTracks = (trackList: any[] | undefined | null, actualUrl: string | null) => {
        if (!trackList || !Array.isArray(trackList) || !actualUrl) return
        trackList.forEach((t) => {
          if (t && (t.assetUrl === 'VIDEO_URL' || t.assetUrl === 'AUDIO_URL' || !t.assetUrl || t.assetUrl === 'url')) {
            t.assetUrl = actualUrl
          }
        })
      }

      if (targetJson.tracks) {
        finalizeTracks(targetJson.tracks.media, randomVideo?.url || null)
        finalizeTracks(targetJson.tracks.audio, randomAudio?.url || null)
      }

      // Post-process to randomize mediaStartAt based on known true durations
      const fps = targetJson.fps || 30
      if (targetJson.tracks?.media) {
        for (const t of targetJson.tracks.media) {
          const matchedAsset = assets.find((a) => a.url === t.assetUrl) as any
          if (matchedAsset && matchedAsset.duration) {
            const requireSec = (t.durationInFrames || 0) / fps
            const maxStartSec = Math.max(0, matchedAsset.duration - requireSec)
            t.mediaStartAt = Math.floor(Math.random() * maxStartSec * fps)
          }
        }
      }
      if (targetJson.tracks?.audio) {
        for (const t of targetJson.tracks.audio) {
          const matchedAsset = assets.find((a) => a.url === t.assetUrl) as any
          if (matchedAsset && matchedAsset.duration) {
            const requireSec = (t.durationInFrames || 0) / fps
            const maxStartSec = Math.max(0, matchedAsset.duration - requireSec)
            t.mediaStartAt = Math.floor(Math.random() * maxStartSec * fps)
          }
        }
      }

      // Validate
      const validated = DynamicCompositionSchema.parse(targetJson)
      return {
        composition: validated,
        templateId: targetTemplate.id,
      }
    } catch (error: any) {
      logError('AGENT_TECHNICAL_FAILURE', error, { attempt: attempts, accountId })
      lastError = error.message
      if (attempts >= 2)
        throw new Error(`Technical mapping failed after 2 attempts: ${error.message}`)
    }
  }

  throw new Error('Technical mapping failed unexpectedly.')
}

/**
 * Generates content ideas.
 */
export async function generateContentIdeas(
  accountId: string,
  personaId?: string,
  frameworkId?: string,
): Promise<string[]> {
  const persona = (
    personaId
      ? await prisma.brandPersona.findUnique({ where: { id: personaId } })
      : (await prisma.brandPersona.findFirst({ where: { accountId, isDefault: true } })) ||
        (await prisma.brandPersona.findFirst({ where: { accountId } }))
  ) as any

  const framework = (
    frameworkId
      ? await (prisma as any).ideasFramework.findUnique({ where: { id: frameworkId } })
      : (await (prisma as any).ideasFramework.findFirst({
          where: { accountId, isDefault: true },
        })) || (await (prisma as any).ideasFramework.findFirst({ where: { accountId } }))
  ) as any

  if (!persona || !framework) throw new Error('Persona and Framework required.')

  const model =
    persona.modelSelection === 'OPENAI_GPT_4O'
      ? 'gpt-4o'
      : persona.modelSelection === 'OPENAI_GPT_4O_MINI'
        ? 'gpt-4o-mini'
        : persona.modelSelection === 'OPENAI_GPT_4_TURBO'
          ? 'gpt-4-turbo'
          : persona.modelSelection === 'OPENAI_GPT_4_1'
            ? 'gpt-4-turbo'
            : persona.modelSelection === 'OPENAI_O1'
              ? 'o1-preview'
              : persona.modelSelection === 'OPENAI_O1_MINI'
                ? 'o1-mini'
                : persona.modelSelection === 'GROQ_LLAMA_3_3'
                  ? 'llama-3.3-70b-versatile'
                  : persona.modelSelection === 'GROQ_LLAMA_3_1_70B'
                    ? 'llama-3.1-70b-versatile'
                    : persona.modelSelection === 'GROQ_LLAMA_3_1_8B'
                      ? 'llama3-8b-8192'
                      : persona.modelSelection === 'GROQ_MIXTRAL_8X7B'
                        ? 'mixtral-8x7b-32768'
                        : persona.modelSelection === 'GROQ_DEEPSEEK_R1_70B'
                          ? 'deepseek-r1-distill-llama-70b'
                          : 'llama-3.3-70b-versatile'

  const isGroq = persona.modelSelection.startsWith('GROQ')
  const groqKey = (await getSetting('groq_api_key')) || process.env.GROQ_API_KEY
  const openaiKey = (await getSetting('openai_api_key')) || process.env.OPENAI_API_KEY

  const client = isGroq ? new Groq({ apiKey: groqKey }) : new OpenAI({ apiKey: openaiKey })

  const response = await (client as any).chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: `### NATIVE CONTENT STRATEGIST ROLE:
You are a Content Strategist. Your goal is to generate high-quality content ideas based on the provided TONE and STRATEGY.

### OUTPUT RULES:
- Return ONLY a JSON object.
- Structure: { "ideas": ["String 1", "String 2", ...] }
- Each string in the array must be a complete, self-contained idea.
- Do NOT include numbering, prefixes like "Idea 1:", or separators like "---" inside the strings unless specifically asked for in the STRATEGY.
- If the STRATEGY specifies a quantity (e.g., 3 ideas), respect it. Default to 9.

TONE:
${persona.systemPrompt}

STRATEGY:
${framework.systemPrompt}`,
      },
      { role: 'user', content: 'Generate the ideas now.' },
    ],
    response_format: { type: 'json_object' },
  })

  const content = response.choices[0]?.message?.content
  if (!content) throw new Error('Failed to generate ideas.')
  return JSON.parse(content).ideas
}

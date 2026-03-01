import { NextResponse } from 'next/server'
import { composeVideoWithAgent } from '@/modules/video/agent'
import { prisma } from '@/modules/shared/prisma'
import { auth } from '@/auth'
import { z } from 'zod'
import { DynamicCompositionSchema } from '@/modules/rendering/DynamicComposition/schema'

const ComposeRequestSchema = z.object({
  prompt: z.string().min(3),
  accountId: z.string(),
  format: z.enum(['reel', 'post', 'story']).default('reel'),
  ideaId: z.string().optional(),
})

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const json = await req.json()
    console.log('[DEBUG] Compose Payload:', JSON.stringify(json, null, 2))

    const parsed = ComposeRequestSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request payload', details: parsed.error.format() },
        { status: 400 },
      )
    }

    const { prompt, accountId, format, ideaId } = parsed.data

    const account = await prisma.socialAccount.findUnique({
      where: { id: accountId },
    })

    if (!account || account.userId !== session.user.id) {
      return NextResponse.json({ error: 'Account not found or unauthorized' }, { status: 403 })
    }

    // 1. Run AI Step getting the Target instructions map
    const agentInstructions = await composeVideoWithAgent(prompt, accountId, format)

    // 2. Fetch the actual target Video Template
    const template = await prisma.videoTemplate.findUnique({
      where: { id: agentInstructions.templateId },
    })

    if (!template) {
      throw new Error(
        `Agent hallucinated non-existent template ID: ${agentInstructions.templateId}`,
      )
    }

    // 3. Merge Variables into Target Template
    const baseSchema = JSON.parse(JSON.stringify(template.schemaJson)) as any

    if (baseSchema.tracks) {
      // Merge Text Slots
      if (baseSchema.tracks.text) {
        baseSchema.tracks.text = baseSchema.tracks.text.map((n: any) => {
          if (agentInstructions.textSlots[n.id]) {
            n.content = agentInstructions.textSlots[n.id]
          }
          return n
        })
      }

      // Merge Media Slots (both visual media and audio mapped under mediaSlots in AI proxy)
      if (baseSchema.tracks.media) {
        baseSchema.tracks.media = baseSchema.tracks.media.map((n: any) => {
          if (agentInstructions.mediaSlots[n.id]) {
            n.assetUrl = agentInstructions.mediaSlots[n.id]
          }
          return n
        })
      }

      if (baseSchema.tracks.audio) {
        baseSchema.tracks.audio = baseSchema.tracks.audio.map((n: any) => {
          if (agentInstructions.mediaSlots[n.id]) {
            n.assetUrl = agentInstructions.mediaSlots[n.id]
          }
          return n
        })
      }
    }

    // Explicitly validate the merged geometry so we don't blow up the video pipeline later
    const validatedSchema = DynamicCompositionSchema.parse(baseSchema)

    // Determine Target Approval State (Phase 5 Trust Logic)
    let isApproved = false
    const persona =
      (await prisma.brandPersona.findFirst({
        where: { accountId, isDefault: true },
      })) ||
      (await prisma.brandPersona.findFirst({
        where: { accountId },
      }))

    if (persona && persona.autoApproveCompositions && template.autoApproveCompositions) {
      isApproved = true
    }

    // 4. Save to Database
    const composition = await prisma.composition.create({
      data: {
        accountId,
        templateId: template.id,
        payload: validatedSchema as unknown as import('@prisma/client').Prisma.InputJsonValue,
        status: isApproved ? 'APPROVED' : 'DRAFT',
      },
    })

    // 5. Consume Idea
    if (ideaId) {
      await prisma.contentIdea.update({
        where: { id: ideaId },
        data: { status: 'USED' },
      })
    }

    return NextResponse.json({ composition }, { status: 200 })
  } catch (error: unknown) {
    console.error('[AGENT_COMPOSE_ROUTE_ERROR]', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'AI output template merge validation failed', details: error.format() },
        { status: 500 },
      )
    }
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Failed to generate composition', message }, { status: 500 })
  }
}

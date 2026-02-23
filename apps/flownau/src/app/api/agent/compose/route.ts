import { NextResponse } from 'next/server'
import { composeVideoWithAgent } from '@/modules/video/agent'
import { prisma } from '@/modules/shared/prisma'
import { auth } from '@/auth'
import { z } from 'zod'
import { DynamicCompositionSchema } from '@/modules/rendering/DynamicComposition/schema'

// Create a schema for incoming requests
const ComposeRequestSchema = z.object({
  prompt: z.string().min(3),
  accountId: z.string(),
  format: z.enum(['reel', 'post', 'story']).default('reel'),
})

export async function POST(req: Request) {
  try {
    // 1. Enforce authentication
    const session = await auth()
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse payload
    const json = await req.json()
    console.log('[DEBUG] Compose Payload:', JSON.stringify(json, null, 2))

    const parsed = ComposeRequestSchema.safeParse(json)

    if (!parsed.success) {
      console.error('[DEBUG] Validation Errors:', JSON.stringify(parsed.error.format(), null, 2))
      return NextResponse.json(
        { error: 'Invalid request payload', details: parsed.error.format() },
        { status: 400 },
      )
    }

    const { prompt, accountId, format } = parsed.data

    // 3. Verify ownership of the accountId
    const account = await prisma.socialAccount.findUnique({
      where: { id: accountId },
      include: { user: true },
    })

    if (!account || account.userId !== session.user.id) {
      return NextResponse.json({ error: 'Account not found or unauthorized' }, { status: 403 })
    }

    // 4. Call the Agent utility
    const compositionSchema = await composeVideoWithAgent(prompt, accountId, format)

    // 5. Parse the LLM's raw response against the schema strictly
    // While `generateObject` implies it is valid, a double-check through Zod ensures strict app safety.
    const validatedSchema = DynamicCompositionSchema.parse(compositionSchema)

    // 6. Save to Database
    const composition = await prisma.composition.create({
      data: {
        accountId,
        prompt,
        schemaJson: validatedSchema as unknown as import('@prisma/client').Prisma.InputJsonValue, // TypeScript expects JsonValue
      },
    })

    return NextResponse.json({ composition }, { status: 200 })
  } catch (error: unknown) {
    console.error('[AGENT_COMPOSE_ROUTE_ERROR]', error)

    // Handle explicit hallucination/validation failures
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'AI output validation failed (hallucination logic)', details: error.format() },
        { status: 500 },
      )
    }

    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Failed to generate composition', message }, { status: 500 })
  }
}

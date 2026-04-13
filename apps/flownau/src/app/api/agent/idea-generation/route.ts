export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { auth } from '@/auth'
import { generateContentIdeas } from '@/modules/ideation/ideation.service'
import { logError } from '@/modules/shared/logger'

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const json = await req.json()
    const { accountId, personaId } = json

    if (!accountId) {
      return NextResponse.json({ error: 'Missing accountId' }, { status: 400 })
    }

    // Verify ownership
    const account = await prisma.socialAccount.findUnique({
      where: { id: accountId },
    })

    if (!account || account.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized account access' }, { status: 403 })
    }

    // 1. Fetch persona
    const persona = personaId
      ? await prisma.brandPersona.findUnique({ where: { id: personaId } })
      : ((await prisma.brandPersona.findFirst({
          where: { accountId, isDefault: true },
        })) ??
        (await prisma.brandPersona.findFirst({
          where: { accountId },
        })))

    if (!persona) {
      return NextResponse.json({ error: 'No Brand Persona setup yet.' }, { status: 400 })
    }

    // 2. Generate Ideas using the production ideation service
    const output = await generateContentIdeas({
      brandName: persona.name,
      brandDNA: persona.systemPrompt,
      inspoItems: [], // nauthenticity integration in Phase 5
    })

    // 3. Trust Logic: Determine status
    const initialStatus = persona.autoApproveIdeas ? 'APPROVED' : 'PENDING'

    // 4. Save to Database
    const ops = output.ideas.map((idea) => {
      const ideaText = `[${idea.format.toUpperCase()}] Hook: ${idea.hook}\nAngle: ${idea.angle}\nScript: ${idea.script}\nCTA: ${idea.cta}`

      return prisma.contentIdea.create({
        data: {
          accountId,
          ideaText,
          status: initialStatus,
          source: 'internal',
        },
      })
    })

    const generatedIdeas = await Promise.all(ops)

    return NextResponse.json(
      {
        ideas: generatedIdeas,
        summary: output.briefSummary,
      },
      { status: 200 },
    )
  } catch (error: unknown) {
    logError('IDEA_GENERATION_ROUTE_ERROR', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Failed to generate ideas', message }, { status: 500 })
  }
}

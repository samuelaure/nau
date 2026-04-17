export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { checkAccountAccess } from '@/modules/shared/actions'
import { generateContentIdeas } from '@/modules/ideation/ideation.service'
import { logError } from '@/modules/shared/logger'

export async function POST(req: Request) {
  try {
    const json = await req.json()
    const { accountId, personaId, frameworkId, concept } = json

    if (!accountId) {
      return NextResponse.json({ error: 'Missing accountId' }, { status: 400 })
    }

    await checkAccountAccess(accountId)

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

    // 2. Optionally fetch strategy framework
    const framework = frameworkId
      ? await prisma.ideasFramework.findUnique({ where: { id: frameworkId } })
      : await prisma.ideasFramework.findFirst({ where: { accountId, isDefault: true } })

    // 3. Per-origin settings (with fallback for existing personas without new fields)
    const count = (persona as any).manualCount ?? 5
    const autoApprove = (persona as any).manualAutoApprove ?? persona.autoApproveIdeas

    // 4. Generate ideas
    const output = await generateContentIdeas({
      brandName: persona.name,
      dna: persona.systemPrompt,
      strategy: framework?.systemPrompt,
      concept: concept ?? undefined,
      count,
      inspoItems: [],
    })

    // 5. Save ideas with correct source/priority
    const ops = output.ideas.map((idea) => {
      const ideaText = `[${idea.format.toUpperCase()}] Hook: ${idea.hook}\nAngle: ${idea.angle}\nScript: ${idea.script}\nCTA: ${idea.cta}`

      return prisma.contentIdea.create({
        data: {
          accountId,
          ideaText,
          status: autoApprove ? 'APPROVED' : 'PENDING',
          source: 'manual',
          priority: 2,
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

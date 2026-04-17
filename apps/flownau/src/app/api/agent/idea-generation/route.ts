export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { checkAccountAccess } from '@/modules/shared/actions'
import { generateContentIdeas } from '@/modules/ideation/ideation.service'
import { logError } from '@/modules/shared/logger'

export async function POST(req: Request) {
  try {
    const json = await req.json()
    const {
      accountId,
      personaId,
      frameworkId,
      concept,
      count: countOverride,
      source = 'manual',
    } = json

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

    // 2. Optionally fetch strategy framework (Strategy prompts are prioritized over Persona prompts for ideation)
    const framework = frameworkId
      ? await prisma.ideasFramework.findUnique({ where: { id: frameworkId } })
      : await prisma.ideasFramework.findFirst({ where: { accountId, isDefault: true } })

    // 3. Setup Context Based on Source
    let digest = undefined
    let sourceRef = null
    let count = 5
    let autoApprove = false
    let priority = 2

    if (source === 'automatic') {
      const { fetchBrandDigest } = await import('@/modules/ideation/sources/inspo-source')
      digest = await fetchBrandDigest(accountId)
      count =
        typeof countOverride === 'number' ? countOverride : ((persona as any).automaticCount ?? 5)
      autoApprove = (persona as any).automaticAutoApprove ?? false
      priority = 3
      sourceRef =
        digest && digest.attachedUrls.length > 0
          ? digest.attachedUrls.length === 1
            ? digest.attachedUrls[0]
            : JSON.stringify(digest.attachedUrls)
          : null
    } else {
      // Manual mode
      count =
        typeof countOverride === 'number' ? countOverride : ((persona as any).manualCount ?? 5)
      autoApprove = (persona as any).manualAutoApprove ?? false
      priority = 2
    }

    // 4. Generate ideas
    const output = await generateContentIdeas({
      brandName: persona.name,
      dna: persona.systemPrompt,
      strategy: framework?.systemPrompt,
      concept: concept ?? undefined,
      count,
      digest: digest ?? undefined,
    })

    // 5. Save ideas with correct source/priority
    const ops = output.ideas.map((idea) => {
      const ideaText = `[${idea.format.toUpperCase()}] Hook: ${idea.hook}\nAngle: ${idea.angle}\nScript: ${idea.script}\nCTA: ${idea.cta}`

      return prisma.contentIdea.create({
        data: {
          accountId,
          ideaText,
          status: autoApprove ? 'APPROVED' : 'PENDING',
          source,
          priority,
          sourceRef,
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

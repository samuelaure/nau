export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { composeVideoWithAgent } from '@/modules/video/agent'
import { prisma } from '@/modules/shared/prisma'
import { auth } from '@/auth'
import { z } from 'zod'

const ComposeRequestSchema = z.object({
  prompt: z.string().min(3),
  accountId: z.string(),
  format: z.enum(['reel', 'post', 'story']).default('reel'),
  ideaId: z.string().optional(),
  personaId: z.string().optional(),
  templateId: z.string().optional(),
})

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const json = await req.json()
    const parsed = ComposeRequestSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request payload', details: parsed.error.format() },
        { status: 400 },
      )
    }

    const { prompt, accountId, format, ideaId, personaId, templateId } = parsed.data

    const account = await prisma.socialAccount.findUnique({
      where: { id: accountId },
    })

    if (!account || account.userId !== session.user.id) {
      return NextResponse.json({ error: 'Account not found or unauthorized' }, { status: 403 })
    }

    // 1. Run AI Step (Director -> Creative -> Technical)
    const { composition, templateId: finalTemplateId } = await composeVideoWithAgent(
      prompt,
      accountId,
      format,
      templateId,
      personaId,
    )

    // 2. Determine Approval State (Trust Logic)
    const persona = (
      personaId
        ? await prisma.brandPersona.findUnique({ where: { id: personaId } })
        : (await prisma.brandPersona.findFirst({ where: { accountId, isDefault: true } })) ||
          (await prisma.brandPersona.findFirst({ where: { accountId } }))
    ) as any

    const template = (await prisma.template.findUnique({ where: { id: finalTemplateId } })) as any

    let isApproved = false
    if (persona?.autoApproveCompositions && template?.autoApproveCompositions) {
      isApproved = true
    }

    // 3. Save to Database
    const newComposition = await prisma.composition.create({
      data: {
        accountId,
        templateId: finalTemplateId,
        payload: composition as any,
        caption: (composition as any).caption || null,
        status: isApproved ? 'APPROVED' : 'DRAFT',
      },
    })

    // 4. Consume Idea
    if (ideaId) {
      await prisma.contentIdea.update({
        where: { id: ideaId },
        data: { status: 'USED' },
      })
    }

    return NextResponse.json({ composition: newComposition }, { status: 200 })
  } catch (error: unknown) {
    console.error('[AGENT_COMPOSE_ROUTE_ERROR]', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Failed to generate composition', message }, { status: 500 })
  }
}

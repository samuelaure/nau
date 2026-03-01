import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { auth } from '@/auth'
import { generateContentIdeas } from '@/modules/video/agent'

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const json = await req.json()
    const { accountId } = json

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

    // 1. Fetch persona to check ideation auto-approve state
    const persona =
      (await prisma.brandPersona.findFirst({
        where: { accountId, isDefault: true },
      })) ||
      (await prisma.brandPersona.findFirst({
        where: { accountId },
      }))

    if (!persona) {
      return NextResponse.json({ error: 'No Brand Persona setup yet.' }, { status: 400 })
    }

    // 2. Generate Ideas
    const ideasTextArray = await generateContentIdeas(accountId)

    // 3. Trust Logic Implementation: Determine status
    const initialStatus = persona.autoApproveIdeas ? 'APPROVED' : 'PENDING'

    // 4. Save to Database
    const ops = ideasTextArray.map((idea) => {
      return prisma.contentIdea.create({
        data: {
          accountId,
          ideaText: idea,
          status: initialStatus,
        },
      })
    })

    const generatedIdeas = await Promise.all(ops)

    return NextResponse.json({ ideas: generatedIdeas }, { status: 200 })
  } catch (error: unknown) {
    console.error('[IDEA_GENERATION_ROUTE_ERROR]', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Failed to generate ideas', message }, { status: 500 })
  }
}

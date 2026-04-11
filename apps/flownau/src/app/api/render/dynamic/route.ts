export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/modules/shared/prisma'
import { renderAndUpload } from '@/modules/video/renderer'
import { DynamicCompositionSchema } from '@/modules/rendering/DynamicComposition/schema'

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { schema, compositionId, accountId } = body

    if (!schema || !compositionId || !accountId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const parsedSchema = DynamicCompositionSchema.safeParse(schema)
    if (!parsedSchema.success) {
      return NextResponse.json({ error: 'Invalid schema' }, { status: 400 })
    }

    const composition = await prisma.composition.findUnique({
      where: {
        id: compositionId,
        accountId: accountId,
        account: {
          userId: session.user.id,
        },
      },
      include: {
        account: true,
      },
    })

    if (!composition || !composition.account) {
      return NextResponse.json({ error: 'Composition not found or unauthorized' }, { status: 404 })
    }

    const renderId = `dyn-${compositionId}-${Date.now()}`
    const projectFolder = composition.account.username || composition.account.id

    // Start rendering. Vercel development will allow this to block.
    const videoUrl = await renderAndUpload({
      templateId: 'DynamicTemplateMaster',
      inputProps: { schema: parsedSchema.data },
      renderId,
      projectFolder,
    })

    // Update the schema and the video URL in the db. We assert it as Prisma.InputJsonValue.
    await prisma.composition.update({
      where: { id: compositionId },
      data: {
        payload: parsedSchema.data as unknown as import('@prisma/client').Prisma.InputJsonValue,
        videoUrl,
      },
    })

    return NextResponse.json({ success: true, videoUrl })
  } catch (error: unknown) {
    console.error('[DYNAMIC_RENDER_ERROR]', error)
    const msg = error instanceof Error ? error.message : 'Unknown rendering failure'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

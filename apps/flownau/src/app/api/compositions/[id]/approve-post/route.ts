export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { getAuthUser } from '@/lib/auth'

/**
 * POST /api/compositions/[id]/approve-post
 *
 * Phase 17: Manual Final Review gate.
 * Moves a RENDERED composition to PUBLISHING, authorizing the publisher cron
 * to publish it on its next run regardless of autoApprovePost setting.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const post = await prisma.post.findUnique({ where: { id } })
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }
    if (post.status !== 'RENDERED_PENDING') {
      return NextResponse.json(
        { error: 'Post must be in RENDERED_PENDING status to approve for posting' },
        { status: 422 },
      )
    }

    const updated = await prisma.post.update({
      where: { id },
      data: { status: 'RENDERED_APPROVED' },
    })

    return NextResponse.json({ post: updated }, { status: 200 })
  } catch (error) {
    console.error('[APPROVE_POST_ERROR]', error)
    return NextResponse.json(
      { error: 'Failed to approve composition for posting' },
      { status: 500 },
    )
  }
}

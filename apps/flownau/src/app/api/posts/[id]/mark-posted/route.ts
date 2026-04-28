export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { checkBrandAccess } from '@/modules/shared/actions'
import { logger } from '@/lib/logger'
import { onPostPublished } from '@/modules/scheduling/post-published'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const post = await prisma.post.findUnique({
      where: { id },
      select: { id: true, brandId: true, status: true, format: true },
    })

    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

    await checkBrandAccess(post.brandId)

    await prisma.post.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    })

    logger.info({ postId: id, format: post.format }, '[MARK_POSTED] Post manually marked as published')
    await onPostPublished(id, post.brandId)

    return NextResponse.json({ success: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

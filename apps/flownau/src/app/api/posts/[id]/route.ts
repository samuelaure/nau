import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { checkBrandAccess } from '@/modules/shared/actions'
import { logError } from '@/modules/shared/logger'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        template: true,
        renderJob: true,
      },
    })
    if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await checkBrandAccess(post.brandId)
    return NextResponse.json({ post })
  } catch (error) {
    logError('GET /api/posts/[id]', error)
    return NextResponse.json({ error: 'Failed to fetch post' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()

    const post = await prisma.post.findUnique({ where: { id } })
    if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await checkBrandAccess(post.brandId)

    const {
      slotId,
      status,
      ideaText,
      format,
      templateId,
      creative,
      payload,
      caption,
      hashtags,
      sceneTypes,
      topicHash,
      scheduledAt,
      videoUrl,
      coverUrl,
      externalPostId,
      externalPostUrl,
      publishAttempts,
      lastPublishError,
      userPostedManually,
      publishedAt,
      brandPersonaId,
      userUploadedMediaUrl,
    } = body

    const updated = await prisma.post.update({
      where: { id },
      data: {
        ...(status !== undefined && { status }),
        ...(ideaText !== undefined && { ideaText }),
        ...(format !== undefined && { format }),
        ...(templateId !== undefined && { templateId }),
        ...(creative !== undefined && { creative }),
        ...(payload !== undefined && { payload }),
        ...(caption !== undefined && { caption }),
        ...(hashtags !== undefined && { hashtags }),
        ...(sceneTypes !== undefined && { sceneTypes }),
        ...(topicHash !== undefined && { topicHash }),
        ...(scheduledAt !== undefined && { scheduledAt: scheduledAt ? new Date(scheduledAt) : null }),
        ...(videoUrl !== undefined && { videoUrl }),
        ...(coverUrl !== undefined && { coverUrl }),
        ...(externalPostId !== undefined && { externalPostId }),
        ...(externalPostUrl !== undefined && { externalPostUrl }),
        ...(publishAttempts !== undefined && { publishAttempts }),
        ...(lastPublishError !== undefined && { lastPublishError }),
        ...(userPostedManually !== undefined && { userPostedManually }),
        ...(publishedAt !== undefined && { publishedAt: publishedAt ? new Date(publishedAt) : null }),
        ...(brandPersonaId !== undefined && { brandPersonaId }),
        ...(userUploadedMediaUrl !== undefined && { userUploadedMediaUrl }),
      },
    })

    // Handle slot assignment / rescheduling:
    // Release the post's previous slot (if any), then claim the new one.
    if (slotId) {
      const previousSlot = await prisma.postSlot.findFirst({
        where: { postId: id },
        select: { id: true },
      })
      if (previousSlot && previousSlot.id !== slotId) {
        await prisma.postSlot.update({
          where: { id: previousSlot.id },
          data: { status: 'empty', postId: null },
        })
      }
      await prisma.postSlot.update({
        where: { id: slotId },
        data: { status: 'filled', postId: id },
      })
    }

    return NextResponse.json({ post: updated })
  } catch (error) {
    logError('PATCH /api/posts/[id]', error)
    return NextResponse.json({ error: 'Failed to update post' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const post = await prisma.post.findUnique({ where: { id } })
    if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await checkBrandAccess(post.brandId)
    await prisma.post.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    logError('DELETE /api/posts/[id]', error)
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 })
  }
}

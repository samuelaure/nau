import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { checkBrandAccessForRoute } from '@/lib/auth'
import { logError } from '@/modules/shared/logger'
import { triggerRenderForPost } from '@/modules/renderer/render-queue'
import { storage, keyFromCdnUrl } from '@/modules/shared/r2'
import { flownau } from 'nau-storage'

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
    const denied = await checkBrandAccessForRoute(post.brandId); if (denied) return denied
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
    const denied2 = await checkBrandAccessForRoute(post.brandId); if (denied2) return denied2

    const {
      slotId,
      releaseSlot,
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
      userUploadedMediaUrl,
      clearRenderSnapshot,
    } = body

    // When clearRenderSnapshot is set, strip the saved asset snapshot so the
    // next render queries fresh b-roll/audio instead of reusing the previous selection.
    let creativeUpdate = creative
    if (clearRenderSnapshot && post.creative && typeof post.creative === 'object') {
      const { renderSnapshot: _dropped, ...rest } = post.creative as Record<string, unknown>
      creativeUpdate = rest
    }

    const updated = await prisma.post.update({
      where: { id },
      data: {
        ...(status !== undefined && { status }),
        ...(ideaText !== undefined && { ideaText }),
        ...(format !== undefined && { format }),
        ...(templateId !== undefined && { templateId }),
        ...(creativeUpdate !== undefined && { creative: creativeUpdate }),
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
        ...(userUploadedMediaUrl !== undefined && { userUploadedMediaUrl }),
      },
    })

    // Auto-trigger render when a draft transitions into DRAFT_APPROVED
    // (covers manual user approval and the re-render flow).
    if (status === 'DRAFT_APPROVED' && post.status !== 'DRAFT_APPROVED') {
      await triggerRenderForPost(id).catch((err) =>
        logError('PATCH /api/posts/[id] triggerRenderForPost', err),
      )
    }

    // Handle slot assignment / rescheduling:
    // Release the post's previous slot (if any), then claim the new one.
    if (slotId || releaseSlot) {
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
      if (slotId) {
        await prisma.postSlot.update({
          where: { id: slotId },
          data: { status: 'filled', postId: id },
        })
      }
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
    const denied3 = await checkBrandAccessForRoute(post.brandId); if (denied3) return denied3

    // Free the slot before deleting so it stays in the calendar as empty
    // rather than becoming a phantom filled slot with no post.
    await prisma.postSlot.updateMany({
      where: { postId: id },
      data: { status: 'empty', postId: null },
    })
    await prisma.post.delete({ where: { id } })

    // Delete all R2 files associated with this post.
    // The three render-output keys are deterministic and always attempted (delete
    // of a non-existent key is a no-op on R2). The user-uploaded URL may point to
    // a different key (generated at upload time) so we derive it from the stored URL.
    const r2Keys = new Set([
      flownau.renderOutput(post.brandId, id),
      flownau.renderCover(post.brandId, id),
      flownau.renderStill(post.brandId, id),
    ])
    for (const url of [post.userUploadedMediaUrl, post.videoUrl, post.coverUrl]) {
      if (!url) continue
      const key = keyFromCdnUrl(url)
      if (key) r2Keys.add(key)
    }
    storage.deleteMany([...r2Keys]).catch((err) =>
      logError('DELETE /api/posts/[id] R2 cleanup', err),
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    logError('DELETE /api/posts/[id]', error)
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 })
  }
}

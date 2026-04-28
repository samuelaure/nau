export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { storage } from '@/modules/shared/r2'
import { flownau, extFromMime } from 'nau-storage'
import { getAuthUser } from '@/lib/auth'
import { checkBrandAccess } from '@/modules/shared/actions'
import { logError, logger } from '@/modules/shared/logger'
import { createId } from '@paralleldrive/cuid2'

const UPLOADABLE_FORMATS = new Set(['head_talk', 'replicate'])

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const post = await prisma.post.findUnique({
      where: { id },
      select: { id: true, brandId: true, format: true, status: true },
    })

    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

    await checkBrandAccess(post.brandId)

    if (!UPLOADABLE_FORMATS.has(post.format ?? '')) {
      return NextResponse.json(
        { error: `Video upload is only supported for: ${[...UPLOADABLE_FORMATS].join(', ')}` },
        { status: 400 },
      )
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const ext = extFromMime(file.type) || file.name.split('.').pop() || 'mp4'
    const uploadId = `${id}-${createId()}`
    const key = flownau.renderOutput(post.brandId, uploadId).replace('.mp4', `.${ext}`)
    const buffer = Buffer.from(await file.arrayBuffer())

    const videoUrl = await storage.upload(key, buffer, { mimeType: file.type || 'video/mp4' })

    const updated = await prisma.post.update({
      where: { id },
      data: {
        videoUrl,
        userUploadedMediaUrl: videoUrl,
        status: 'RENDERED_PENDING',
      },
    })

    logger.info({ postId: id, format: post.format, key }, '[UPLOAD_VIDEO] Video uploaded')

    return NextResponse.json({ videoUrl, status: updated.status })
  } catch (error) {
    logError('UPLOAD_VIDEO_ERROR', error)
    const msg = error instanceof Error ? error.message : 'Upload failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

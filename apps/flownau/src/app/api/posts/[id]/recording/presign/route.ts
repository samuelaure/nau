export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { storage } from '@/modules/shared/r2'
import { flownau, extFromMime } from 'nau-storage'
import { getAuthUser, checkBrandAccessForRoute } from '@/lib/auth'
import { logError } from '@/modules/shared/logger'
import { createId } from '@paralleldrive/cuid2'

const UPLOADABLE_FORMATS = new Set(['head_talk', 'trial_head_talk', 'replicate'])

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const post = await prisma.post.findUnique({
      where: { id },
      select: { id: true, brandId: true, format: true },
    })
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

    const denied = await checkBrandAccessForRoute(post.brandId)
    if (denied) return denied

    if (!UPLOADABLE_FORMATS.has(post.format ?? '')) {
      return NextResponse.json(
        { error: `Recording upload is only supported for: ${[...UPLOADABLE_FORMATS].join(', ')}` },
        { status: 400 },
      )
    }

    const { mimeType } = (await req.json()) as { mimeType?: string }
    if (!mimeType) return NextResponse.json({ error: 'mimeType is required' }, { status: 400 })

    const ext = extFromMime(mimeType) || 'mp4'
    const uploadId = `${id}-${createId()}`
    const key = flownau.renderOutput(post.brandId, uploadId).replace('.mp4', `.${ext}`)

    const { uploadUrl, cdnUrl } = await storage.presignUpload(key, mimeType, 3600)

    return NextResponse.json({ uploadUrl, cdnUrl })
  } catch (error) {
    logError('POST /api/posts/[id]/recording/presign', error)
    return NextResponse.json({ error: 'Failed to issue presigned URL' }, { status: 500 })
  }
}

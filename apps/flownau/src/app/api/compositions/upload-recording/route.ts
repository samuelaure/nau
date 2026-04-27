export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { storage } from '@/modules/shared/r2'
import { flownau, extFromMime } from 'nau-storage'
import { getAuthUser } from '@/lib/auth'
import { logError } from '@/modules/shared/logger'
import { createId } from '@paralleldrive/cuid2'

const USER_MANAGED_FORMATS = new Set(['head_talk', 'replicate'])

/**
 * POST /api/compositions/upload-recording
 *
 * Phase 18: Accepts user-supplied media for head_talk or replicate compositions.
 * Uploads to R2, sets userUploadedMediaUrl, moves status to RENDERED so the
 * renderer worker can do a passthrough and the publisher can publish it.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const compositionId = formData.get('compositionId') as string | null
    const brandId = formData.get('brandId') as string | null

    if (!file || !compositionId || !brandId) {
      return NextResponse.json(
        { error: 'Missing file, compositionId, or brandId' },
        { status: 400 },
      )
    }

    const composition = await prisma.composition.findUnique({ where: { id: compositionId } })
    if (!composition || composition.brandId !== brandId) {
      return NextResponse.json({ error: 'Composition not found' }, { status: 404 })
    }
    if (!USER_MANAGED_FORMATS.has(composition.format)) {
      return NextResponse.json(
        { error: 'Only head_talk and replicate compositions accept media uploads' },
        { status: 400 },
      )
    }

    const ext = extFromMime(file.type) || file.name.split('.').pop() || 'mp4'
    const recordingId = `${compositionId}-${createId()}`
    const key = flownau.renderOutput(brandId, recordingId).replace('.mp4', `.${ext}`)
    const buffer = Buffer.from(await file.arrayBuffer())

    const mediaUrl = await storage.upload(key, buffer, {
      mimeType: file.type || 'video/mp4',
    })

    // Phase 18: set userUploadedMediaUrl — renderer will do a passthrough job.
    // Also update videoUrl for backward compatibility with playback.
    await prisma.composition.update({
      where: { id: compositionId },
      data: {
        userUploadedMediaUrl: mediaUrl,
        videoUrl: mediaUrl,
        status: 'RENDERED',
      },
    })

    return NextResponse.json({ videoUrl: mediaUrl, status: 'RENDERED' }, { status: 200 })
  } catch (error) {
    logError('UPLOAD_RECORDING_ERROR', error)
    const message = error instanceof Error ? error.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

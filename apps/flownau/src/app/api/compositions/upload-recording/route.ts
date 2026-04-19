export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { r2, R2_BUCKET } from '@/modules/shared/r2'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getAuthUser } from '@/lib/auth'
import { logError } from '@/modules/shared/logger'
import { createId } from '@paralleldrive/cuid2'

/**
 * POST /api/compositions/upload-recording
 * Accepts a recorded video for a head_talk composition.
 * Uploads to R2, updates videoUrl, moves status to RENDERED.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const compositionId = formData.get('compositionId') as string | null
    const accountId = formData.get('accountId') as string | null

    if (!file || !compositionId || !accountId) {
      return NextResponse.json(
        { error: 'Missing file, compositionId, or accountId' },
        { status: 400 },
      )
    }

    const composition = await prisma.composition.findUnique({ where: { id: compositionId } })
    if (!composition || composition.accountId !== accountId) {
      return NextResponse.json({ error: 'Composition not found' }, { status: 404 })
    }
    if (composition.format !== 'head_talk') {
      return NextResponse.json(
        { error: 'Only head_talk compositions accept recording uploads' },
        { status: 400 },
      )
    }

    const ext = file.name.split('.').pop() ?? 'mp4'
    const key = `recordings/${accountId}/${compositionId}-${createId()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    if (!R2_BUCKET) throw new Error('R2_BUCKET_NAME is not configured')

    await r2.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: file.type || 'video/mp4',
      }),
    )

    const r2PublicUrl = process.env.R2_PUBLIC_URL
    const videoUrl = r2PublicUrl ? `${r2PublicUrl}/${key}` : key

    await prisma.composition.update({
      where: { id: compositionId },
      data: { videoUrl, status: 'RENDERED' },
    })

    return NextResponse.json({ videoUrl, status: 'RENDERED' }, { status: 200 })
  } catch (error) {
    logError('UPLOAD_RECORDING_ERROR', error)
    const message = error instanceof Error ? error.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

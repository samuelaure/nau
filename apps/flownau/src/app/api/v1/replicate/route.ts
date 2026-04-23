export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { validateServiceToken, unauthorizedResponse } from '@/modules/shared/nau-auth'
import { prisma } from '@/modules/shared/prisma'
import { logError, logger } from '@/modules/shared/logger'
import { resolveProvenance } from '@/modules/ideation/provenance'
import type { Prisma } from '@prisma/client'

const ReplicateRequestSchema = z.object({
  accountId: z.string().min(1),
  caption: z.string().min(1),
  mediaUrl: z.string().url().optional(),
  mediaType: z.enum(['video', 'image', 'carousel']).default('video'),
  externalPostId: z.string().optional(),
  externalPostUrl: z.string().url().optional(),
  transcription: z.string().optional(),
})

/**
 * POST /api/v1/replicate
 * Ingests a captured post from 9naŭ mobile into the Content Pool as a DRAFT composition.
 * Bypasses ContentIdea — goes directly to Composition.
 * Auth: NAU_SERVICE_KEY (x-nau-service-key header)
 */
export async function POST(req: Request) {
  if (!(await validateServiceToken(req))) return unauthorizedResponse()

  try {
    const body = await req.json()
    const parsed = ReplicateRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.format() },
        { status: 400 },
      )
    }

    const {
      accountId,
      caption,
      mediaUrl,
      mediaType,
      externalPostId,
      externalPostUrl,
      transcription,
    } = parsed.data

    const account = await prisma.socialAccount.findUnique({ where: { id: accountId } })
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // Phase 18: replicate is its own first-class format. The mediaUrl is treated as
    // user-supplied so the renderer packages it rather than running the composer.
    const format = 'replicate'

    // Resolve provenance (captured for audit — there's no idea for replicate flow)
    const provenance = await resolveProvenance(accountId)

    const persona = provenance.brandPersonaId
      ? await prisma.brandPersona.findUnique({ where: { id: provenance.brandPersonaId } })
      : null
    const autoApprovePool = persona?.autoApprovePool ?? false

    const payload: Record<string, unknown> = {
      type: 'replicate',
      originalCaption: caption,
      mediaType,
    }
    if (mediaUrl) payload.mediaUrl = mediaUrl
    if (transcription) payload.transcription = transcription

    const composition = await prisma.composition.create({
      data: {
        accountId,
        format,
        source: 'replicate',
        payload: payload as unknown as Prisma.InputJsonValue,
        caption,
        externalPostId: externalPostId ?? null,
        externalPostUrl: externalPostUrl ?? null,
        userUploadedMediaUrl: mediaUrl ?? null,
        status: autoApprovePool ? 'APPROVED' : 'DRAFT',
        brandPersonaId: provenance.brandPersonaId,
        ideasFrameworkId: provenance.ideasFrameworkId,
        contentPrinciplesId: provenance.contentPrinciplesId,
      },
    })

    logger.info(
      `[Replicate] Created composition ${composition.id} for account ${accountId} (${format})`,
    )

    return NextResponse.json({ composition }, { status: 201 })
  } catch (error) {
    logError('REPLICATE_INGEST_ERROR', error)
    const message = error instanceof Error ? error.message : 'Ingest failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

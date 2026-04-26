import { NextResponse } from 'next/server'
import { z } from 'zod'
import { validateServiceToken, unauthorizedResponse } from '@/modules/shared/nau-auth'
import { ingestExternalIdeas } from '@/modules/ideation/sources/external-source'
import { logError } from '@/modules/shared/logger'

const IngestRequestSchema = z.object({
  brandId: z.string().min(1),
  ideas: z
    .array(
      z.object({
        text: z.string().min(1),
        source: z.enum(['inspo', 'user_input', 'reactive', 'captured']),
        sourceRef: z.string().optional(),
        aiLinked: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(50),
  autoApprove: z.boolean().default(false),
})

/**
 * POST /api/v1/ideas/ingest — Bulk ingest content ideas from external sources.
 * Called by: 9naŭ API (triage module), Zazŭ
 * Auth: NAU_SERVICE_KEY
 */
export async function POST(req: Request) {
  if (!(await validateServiceToken(req))) {
    return unauthorizedResponse()
  }

  try {
    const body: unknown = await req.json()
    const input = IngestRequestSchema.parse(body)

    const result = await ingestExternalIdeas(input.brandId, input.ideas, input.autoApprove)

    return NextResponse.json(result)
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.issues },
        { status: 400 },
      )
    }

    const msg = error instanceof Error ? error.message : String(error)
    logError('[IdeasIngestAPI] Failed', error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

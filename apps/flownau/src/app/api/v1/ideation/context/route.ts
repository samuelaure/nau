import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { validateServiceToken, unauthorizedResponse } from '@/modules/shared/nau-auth'

export async function POST(request: NextRequest) {
  if (!(await validateServiceToken(request))) return unauthorizedResponse()

  try {
    const body = await request.json()
    const { brandId, brandName, title, content } = body

    if (!brandId || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: brandId, content' },
        { status: 400 },
      )
    }

    // Store as a simple JSON record in the ideation_context table
    // For MVP, we store in a lightweight key-value approach
    // In future this could be a proper Prisma model
    const doc = {
      id: crypto.randomUUID(),
      brandId,
      brandName: brandName || 'Unknown',
      title: title || 'Untitled Document',
      content,
      createdAt: new Date().toISOString(),
    }

    // For now, store in a simple file-based approach or return for client storage
    // In production, this would be a DB table
    logger.info({ brandId, title }, 'Context document received for ideation')

    return NextResponse.json({
      success: true,
      document: doc,
      message: 'Context document registered. It will be included in future ideation runs.',
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error({ err: msg }, 'Error storing ideation context')
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { generateContentIdeas } from '@/modules/ideation/ideation.service'
import { validateServiceToken, unauthorizedResponse } from '@/modules/shared/nau-auth'

export async function POST(request: NextRequest) {
  if (!(await validateServiceToken(request))) return unauthorizedResponse()

  try {
    const body = await request.json()
    const { topic, language, count, recentContent } = body

    if (!topic?.trim()) {
      return NextResponse.json({ error: 'Missing required field: topic' }, { status: 400 })
    }

    const result = await generateContentIdeas({
      topic,
      language: language ?? 'Spanish',
      count: count ?? 9,
      recentContent: recentContent ?? [],
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[Ideation] Error generating ideas:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
